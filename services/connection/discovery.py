"""Bounded, identity-aware discovery for one DakDash ESP32."""

import ipaddress
import re
import secrets
import socket
import subprocess
import time
from dataclasses import dataclass

from services.connection.protocol import (
    Envelope,
    MessageType,
    PROTOCOL_VERSION,
    ProtocolError,
    decode_envelope,
    encode_datagram,
)


_DEVICE_PATTERN = re.compile(r"^wt32-([0-9a-fA-F]{12})$")
_ARP_PATTERN = re.compile(
    r"\((?P<ip>[^)]+)\)\s+at\s+(?P<mac>[0-9a-fA-F:]+)"
)
_HEX_NONCE_PATTERN = re.compile(r"^[0-9a-fA-F]{16}$")


@dataclass(frozen=True)
class DiscoveryResult:
    host: str
    port: int
    device_id: str
    method: str


def device_id_to_mac(device_id):
    match = _DEVICE_PATTERN.fullmatch(device_id or "")
    if match is None:
        raise ValueError("device ID must be wt32- followed by 12 hex digits")
    compact = match.group(1).lower()
    return ":".join(compact[index:index + 2] for index in range(0, 12, 2))


class ArpCacheResolver:
    def __init__(self, runner=subprocess.run):
        self._runner = runner

    def resolve(self, device_id, excluded_hosts=()):
        expected_mac = device_id_to_mac(device_id)
        excluded = {str(host) for host in excluded_hosts}
        try:
            result = self._runner(
                ["arp", "-an"], capture_output=True, text=True,
                timeout=0.25, check=False,
            )
        except (OSError, subprocess.SubprocessError):
            return None
        for line in result.stdout.splitlines():
            match = _ARP_PATTERN.search(line)
            if match is None or match.group("mac").lower() != expected_mac:
                continue
            host = _valid_unicast_ipv4(match.group("ip"))
            if host is not None and host not in excluded:
                return host
        return None


class DiscoveryClient:
    def __init__(self, socket_factory=socket.socket, arp_resolver=None,
                 nonce_factory=lambda: secrets.token_hex(8),
                 monotonic=time.monotonic, attempts=3,
                 total_timeout_s=0.5, port=1234,
                 broadcast_host="255.255.255.255"):
        if attempts < 1 or total_timeout_s <= 0:
            raise ValueError("discovery bounds must be positive")
        self._socket_factory = socket_factory
        self._arp_resolver = arp_resolver or ArpCacheResolver()
        self._nonce_factory = nonce_factory
        self._monotonic = monotonic
        self._attempts = attempts
        self._total_timeout_s = total_timeout_s
        self._port = port
        self._broadcast_host = broadcast_host

    def discover(self, expected_device_id, excluded_hosts=(),
                 stop_event=None, progress=None):
        excluded = {str(host) for host in excluded_hosts if host}
        if _stopped(stop_event):
            return None
        _report(progress, "PASSIVE_LOOKUP", 0, None, None)
        passive_host = self._arp_resolver.resolve(
            expected_device_id, excluded
        )
        if passive_host is not None:
            result = DiscoveryResult(
                passive_host, self._port, expected_device_id, "arp_cache"
            )
            _report(progress, "FOUND", 0, result.method, result.host)
            return result
        if _stopped(stop_event):
            return None

        nonce = self._nonce_factory()
        if _HEX_NONCE_PATTERN.fullmatch(nonce or "") is None:
            raise ValueError("discovery nonce must be 16 hexadecimal characters")
        request = Envelope(
            PROTOCOL_VERSION,
            MessageType.DISCOVER,
            expected_device_id,
            "",
            0,
            0,
            0,
            0,
        ).with_details({"nonce": nonce})
        datagram = encode_datagram(request)
        try:
            sock = self._socket_factory(socket.AF_INET, socket.SOCK_DGRAM)
        except OSError:
            _report(progress, "NOT_FOUND", 0, None, None)
            return None
        started = self._monotonic()
        attempt = 0
        try:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            for attempt in range(1, self._attempts + 1):
                if _stopped(stop_event):
                    return None
                _report(progress, "BROADCAST_PROBING", attempt, None, None)
                sock.sendto(datagram, (self._broadcast_host, self._port))
                window_end = (
                    started + self._total_timeout_s * attempt / self._attempts
                )
                while not _stopped(stop_event):
                    remaining = window_end - self._monotonic()
                    if remaining <= 0:
                        break
                    sock.settimeout(remaining)
                    try:
                        body, source = sock.recvfrom(1200)
                    except (socket.timeout, TimeoutError):
                        break
                    result = _validated_response(
                        body, source, expected_device_id, nonce
                    )
                    if result is not None:
                        _report(
                            progress, "FOUND", attempt,
                            result.method, result.host,
                        )
                        return result
            _report(progress, "NOT_FOUND", self._attempts, None, None)
            return None
        except OSError:
            _report(progress, "NOT_FOUND", attempt, None, None)
            return None
        finally:
            sock.close()


def _validated_response(body, source, expected_device_id, nonce):
    if len(body) > 1200 or not isinstance(source, tuple) or not source:
        return None
    try:
        envelope = decode_envelope(bytes(body))
    except ProtocolError:
        return None
    if (envelope.message_type is not MessageType.DISCOVER_RESPONSE or
            envelope.device_id != expected_device_id or
            envelope.details.get("nonce") != nonce):
        return None
    source_host = _valid_unicast_ipv4(source[0])
    announced_host = _valid_unicast_ipv4(envelope.details.get("ip"))
    port = envelope.details.get("port")
    if (source_host is None or announced_host != source_host or
            isinstance(port, bool) or
            not isinstance(port, int) or not 1 <= port <= 65535):
        return None
    return DiscoveryResult(
        source_host, port, expected_device_id, "udp_broadcast"
    )


def _valid_unicast_ipv4(value):
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return None
    if (address.version != 4 or address.is_multicast or address.is_unspecified or
            address.is_loopback or address.is_link_local):
        return None
    return str(address)


def _stopped(stop_event):
    return stop_event is not None and stop_event.is_set()


def _report(callback, phase, attempts, method, host):
    if callback is not None:
        callback(phase, attempts, method, host)
