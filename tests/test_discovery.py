import json
import socket
import subprocess
import threading
import unittest

from services.connection.discovery import (
    ArpCacheResolver,
    DiscoveryClient,
    device_id_to_mac,
)


def discovery_response(device_id, nonce, ip="10.93.37.138", port=1234):
    return json.dumps({
        "details": {"ip": ip, "nonce": nonce, "port": port},
        "device_id": device_id,
        "message_type": "DISCOVER_RESPONSE",
        "packet_seq": 0,
        "payload": "",
        "payload_crc32": 0,
        "protocol_version": 1,
        "serial_age_ms": 0,
        "session_id": "boot-test",
        "state_seq": 0,
        "uptime_ms": 100,
    }, separators=(",", ":"), sort_keys=True).encode("utf-8")


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


class FakeSocket:
    def __init__(self, clock, responses=()):
        self.clock = clock
        self.responses = list(responses)
        self.sent = []
        self.timeouts = []
        self.closed = False

    def setsockopt(self, *args):
        pass

    def settimeout(self, timeout):
        self.timeout = timeout
        self.timeouts.append(timeout)

    def sendto(self, data, address):
        self.sent.append((data, address, self.clock()))

    def recvfrom(self, size):
        if self.responses:
            return self.responses.pop(0)
        self.clock.advance(self.timeout)
        raise socket.timeout

    def close(self):
        self.closed = True


class NullArpResolver:
    def resolve(self, device_id, excluded_hosts=()):
        return None


class DiscoveryTests(unittest.TestCase):
    def test_device_identity_derives_exact_ethernet_mac(self):
        self.assertEqual(
            device_id_to_mac("wt32-943cc63d1287"),
            "94:3c:c6:3d:12:87",
        )
        for invalid in ("", "wt32-short", "other-943cc63d1287", "wt32-not-hex-value"):
            with self.subTest(invalid=invalid):
                with self.assertRaises(ValueError):
                    device_id_to_mac(invalid)

    def test_arp_cache_matches_identity_and_excludes_failed_host(self):
        output = "\n".join((
            "? (10.93.37.137) at 00:11:22:33:44:55 on en0 ifscope [ethernet]",
            "? (10.93.37.138) at 94:3c:c6:3d:12:87 on en0 ifscope [ethernet]",
        ))

        def runner(*args, **kwargs):
            return subprocess.CompletedProcess(args[0], 0, output, "")

        resolver = ArpCacheResolver(runner=runner)
        self.assertEqual(
            resolver.resolve("wt32-943cc63d1287"),
            "10.93.37.138",
        )
        self.assertIsNone(
            resolver.resolve("wt32-943cc63d1287", {"10.93.37.138"})
        )

    def test_returns_passive_arp_candidate_without_broadcasting(self):
        class Resolver:
            def resolve(self, device_id, excluded_hosts=()):
                return "10.93.37.138"

        client = DiscoveryClient(
            arp_resolver=Resolver(),
            socket_factory=lambda *args: self.fail("UDP socket opened"),
        )
        result = client.discover("wt32-943cc63d1287")
        self.assertEqual((result.host, result.port, result.method),
                         ("10.93.37.138", 1234, "arp_cache"))

    def test_unanswered_discovery_sends_three_probes_within_500ms(self):
        clock = FakeClock()
        sock = FakeSocket(clock)
        client = DiscoveryClient(
            arp_resolver=NullArpResolver(),
            socket_factory=lambda *args: sock,
            nonce_factory=lambda: "0011223344556677",
            monotonic=clock,
        )
        self.assertIsNone(client.discover("wt32-943cc63d1287"))
        self.assertEqual(len(sock.sent), 3)
        self.assertEqual({address for _, address, _ in sock.sent},
                         {("255.255.255.255", 1234)})
        self.assertLessEqual(clock(), 0.5)
        self.assertTrue(sock.closed)

    def test_ignores_wrong_nonce_and_device_then_accepts_match(self):
        clock = FakeClock()
        expected = "wt32-943cc63d1287"
        nonce = "0011223344556677"
        sock = FakeSocket(clock, [
            (discovery_response(expected, "ffeeddccbbaa0099"),
             ("10.93.37.138", 1234)),
            (discovery_response("wt32-001122334455", nonce),
             ("10.93.37.139", 1234)),
            (discovery_response(expected, nonce),
             ("10.93.37.138", 1234)),
        ])
        client = DiscoveryClient(
            arp_resolver=NullArpResolver(),
            socket_factory=lambda *args: sock,
            nonce_factory=lambda: nonce,
            monotonic=clock,
        )
        result = client.discover(
            expected, excluded_hosts={"10.93.37.138"}
        )
        self.assertEqual((result.host, result.port, result.method),
                         ("10.93.37.138", 1234, "udp_broadcast"))
        self.assertEqual(len(sock.sent), 1)

    def test_cancelled_discovery_sends_nothing(self):
        stopped = threading.Event()
        stopped.set()
        clock = FakeClock()
        sock = FakeSocket(clock)
        client = DiscoveryClient(
            arp_resolver=NullArpResolver(),
            socket_factory=lambda *args: sock,
            monotonic=clock,
        )
        self.assertIsNone(client.discover(
            "wt32-943cc63d1287", stop_event=stopped
        ))
        self.assertEqual(sock.sent, [])


if __name__ == "__main__":
    unittest.main()
