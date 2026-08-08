"""Cancellable scoreboard connection lifecycle and reconnect supervision."""

import random
import socket
import threading
import time

from services.connection.discovery import DiscoveryClient
from services.connection.protocol import MessageType, ProtocolError
from services.connection.tcp_transport import TcpTransport
from services.sport_parsers import FrameParseError, parse_scoreboard_frame


class ConnectionSupervisor(threading.Thread):
    _HEARTBEAT_TIMEOUT_NS = 3_000_000_000

    def __init__(self, sport, host, port, expected_device_id, store,
                 transport_factory=TcpTransport.connect,
                 monotonic_ns=time.monotonic_ns,
                 discovery_factory=DiscoveryClient):
        super().__init__(name="dakdash-connection", daemon=True)
        self._sport = sport
        self._host = host
        self._port = int(port)
        self._expected_device_id = expected_device_id
        self._store = store
        self._transport_factory = transport_factory
        self._discovery_factory = discovery_factory
        self._monotonic_ns = monotonic_ns
        self._stop_event = threading.Event()
        self._transport_lock = threading.Lock()
        self._transport = None
        self._counter_lock = threading.Lock()
        self._discovery_lock = threading.Lock()
        self._parse_errors = 0
        self._protocol_errors = 0
        self._discovery = {
            "phase": "IDLE",
            "active": False,
            "attempts": 0,
            "method": None,
            "requested_host": host or None,
            "resolved_host": None,
        }

    @property
    def parse_errors(self):
        with self._counter_lock:
            return self._parse_errors

    @property
    def protocol_errors(self):
        with self._counter_lock:
            return self._protocol_errors

    def discovery_status(self):
        with self._discovery_lock:
            return dict(self._discovery)

    def run(self):
        delays = (0.25, 0.5, 1.0, 2.0, 5.0)
        backoff_index = 0
        current_session_id = None
        seen_session_ids = set()
        session_packet_seq = None
        session_state_seq = None
        target_host = self._host or None
        discovery_available = True
        if target_host is not None:
            self._record_discovery("DIRECT_CONNECT", 0, None, None)
        if target_host is None:
            discovery_available = False
            result = self._discover_once(set())
            if result is None:
                generation = self._store.start_generation()
                self._store.set_transport(
                    generation, False, self._monotonic_ns()
                )
                self._stop_event.wait()
                return
            target_host = result.host
        while not self._stop_event.is_set():
            transport = None
            generation = None
            handshake_complete = False
            should_discover = False
            try:
                transport = self._transport_factory(
                    target_host, self._port, self._expected_device_id
                )
                self._set_transport(transport)
                if self._stop_event.is_set():
                    break
                hello = transport.handshake(timeout_s=2.0)
                self._validate_hello(hello)
                if discovery_available:
                    discovery_available = False
                    self._record_discovery(
                        "FOUND", 0, "saved_ip", target_host
                    )
                if hello.session_id == current_session_id:
                    if (session_packet_seq is not None and
                            hello.packet_seq <= session_packet_seq):
                        raise ProtocolError("HELLO packet sequence replayed")
                elif hello.session_id in seen_session_ids:
                    raise ProtocolError("prior session replayed")
                else:
                    current_session_id = hello.session_id
                    seen_session_ids.add(hello.session_id)
                    session_state_seq = None
                session_packet_seq = hello.packet_seq
                handshake_complete = True
                generation = self._store.start_generation()
                now_ns = self._monotonic_ns()
                self._store.set_transport(generation, True, now_ns)
                self._store.record_heartbeat(generation, now_ns)
                session_id = hello.session_id
                last_received_ns = now_ns
                backoff_index = 0
                while not self._stop_event.is_set():
                    try:
                        envelope = transport.receive(timeout_s=1.0)
                    except (TimeoutError, socket.timeout):
                        if (self._monotonic_ns() - last_received_ns >=
                                self._HEARTBEAT_TIMEOUT_NS):
                            raise TimeoutError("three heartbeats missed")
                        continue
                    session_packet_seq = self._validate_message(
                        envelope, session_id, session_packet_seq
                    )
                    received_ns = self._monotonic_ns()
                    last_received_ns = received_ns
                    if envelope.message_type is MessageType.HEARTBEAT:
                        self._store.record_heartbeat(generation, received_ns)
                    elif envelope.message_type is MessageType.SNAPSHOT:
                        self._store.record_heartbeat(generation, received_ns)
                        if (session_state_seq is not None and
                                envelope.state_seq < session_state_seq):
                            raise ProtocolError("state sequence rolled back")
                        if envelope.state_seq == session_state_seq:
                            continue
                        session_state_seq = envelope.state_seq
                        try:
                            score = parse_scoreboard_frame(self._sport, envelope.payload)
                        except FrameParseError:
                            self._increment("parse")
                            continue
                        self._store.publish(generation, envelope, score, received_ns)
                    elif envelope.message_type is MessageType.STATUS:
                        self._store.record_heartbeat(generation, received_ns)
            except ProtocolError:
                self._increment("protocol")
                should_discover = not handshake_complete and discovery_available
                if not handshake_complete:
                    generation = self._store.start_generation()
                    self._store.mark_incompatible(generation)
            except (OSError, TimeoutError):
                should_discover = not handshake_complete and discovery_available
                if generation is None:
                    generation = self._store.start_generation()
                    self._store.set_transport(
                        generation, False, self._monotonic_ns()
                    )
            finally:
                if generation is not None:
                    self._store.set_transport(
                        generation, False, self._monotonic_ns()
                    )
                if transport is not None:
                    transport.close()
                self._clear_transport(transport)

            if should_discover and not self._stop_event.is_set():
                discovery_available = False
                result = self._discover_once({target_host})
                if result is not None:
                    target_host = result.host
                    backoff_index = 0
                    continue

            if self._stop_event.is_set():
                break
            delay = delays[min(backoff_index, len(delays) - 1)]
            backoff_index = min(backoff_index + 1, len(delays) - 1)
            self._stop_event.wait(delay + random.uniform(0, delay * 0.2))

    def _discover_once(self, excluded_hosts):
        client = self._discovery_factory()
        return client.discover(
            self._expected_device_id,
            excluded_hosts=excluded_hosts,
            stop_event=self._stop_event,
            progress=self._record_discovery,
        )

    def _record_discovery(self, phase, attempts, method, host):
        with self._discovery_lock:
            self._discovery["phase"] = phase
            self._discovery["active"] = phase in {
                "DIRECT_CONNECT", "PASSIVE_LOOKUP", "BROADCAST_PROBING"
            }
            self._discovery["attempts"] = attempts
            if method is not None:
                self._discovery["method"] = method
            if host is not None:
                self._discovery["resolved_host"] = host

    def stop(self, timeout_s=2.0):
        self._stop_event.set()
        with self._transport_lock:
            transport = self._transport
        if transport is not None:
            transport.close()
        if self.ident is not None and threading.current_thread() is not self:
            self.join(timeout_s)
        return not self.is_alive()

    def _validate_hello(self, envelope):
        if envelope.message_type is not MessageType.HELLO:
            raise ProtocolError("expected HELLO response")
        if envelope.device_id != self._expected_device_id:
            raise ProtocolError("unexpected device ID")
        if not envelope.session_id:
            raise ProtocolError("HELLO session is empty")

    def _validate_message(self, envelope, session_id, last_packet_seq):
        if envelope.device_id != self._expected_device_id:
            raise ProtocolError("message device ID changed")
        if envelope.session_id != session_id:
            raise ProtocolError("message session changed")
        if envelope.packet_seq <= last_packet_seq:
            raise ProtocolError("packet sequence did not increase")
        if envelope.message_type not in {
                MessageType.SNAPSHOT, MessageType.HEARTBEAT, MessageType.STATUS}:
            raise ProtocolError("unexpected post-handshake message type")
        return envelope.packet_seq

    def _set_transport(self, transport):
        with self._transport_lock:
            self._transport = transport

    def _clear_transport(self, transport):
        with self._transport_lock:
            if self._transport is transport:
                self._transport = None

    def _increment(self, counter):
        with self._counter_lock:
            if counter == "parse":
                self._parse_errors += 1
            else:
                self._protocol_errors += 1
