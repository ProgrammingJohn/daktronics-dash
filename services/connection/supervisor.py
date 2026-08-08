"""Cancellable scoreboard connection lifecycle and reconnect supervision."""

import random
import threading
import time

from services.connection.protocol import MessageType, ProtocolError
from services.connection.tcp_transport import TcpTransport
from services.sport_parsers import FrameParseError, parse_scoreboard_frame


class ConnectionSupervisor(threading.Thread):
    def __init__(self, sport, host, port, expected_device_id, store,
                 transport_factory=TcpTransport.connect,
                 monotonic_ns=time.monotonic_ns):
        super().__init__(name="dakdash-connection", daemon=True)
        self._sport = sport
        self._host = host
        self._port = int(port)
        self._expected_device_id = expected_device_id
        self._store = store
        self._transport_factory = transport_factory
        self._monotonic_ns = monotonic_ns
        self._stop_event = threading.Event()
        self._transport_lock = threading.Lock()
        self._transport = None
        self._counter_lock = threading.Lock()
        self._parse_errors = 0
        self._protocol_errors = 0

    @property
    def parse_errors(self):
        with self._counter_lock:
            return self._parse_errors

    @property
    def protocol_errors(self):
        with self._counter_lock:
            return self._protocol_errors

    def run(self):
        generation = self._store.start_generation()
        delays = (0.25, 0.5, 1.0, 2.0, 5.0)
        backoff_index = 0
        while not self._stop_event.is_set():
            transport = None
            try:
                transport = self._transport_factory(
                    self._host, self._port, self._expected_device_id
                )
                self._set_transport(transport)
                if self._stop_event.is_set():
                    break
                hello = transport.handshake(timeout_s=2.0)
                now_ns = self._monotonic_ns()
                self._store.set_transport(generation, True, now_ns)
                self._store.record_heartbeat(generation, now_ns)
                session_id = hello.session_id
                backoff_index = 0
                while not self._stop_event.is_set():
                    try:
                        envelope = transport.receive(timeout_s=1.0)
                    except TimeoutError:
                        continue
                    self._validate_message(envelope, session_id)
                    received_ns = self._monotonic_ns()
                    if envelope.message_type is MessageType.HEARTBEAT:
                        self._store.record_heartbeat(generation, received_ns)
                    elif envelope.message_type is MessageType.SNAPSHOT:
                        self._store.record_heartbeat(generation, received_ns)
                        try:
                            score = parse_scoreboard_frame(self._sport, envelope.payload)
                        except FrameParseError:
                            self._increment("parse")
                            continue
                        self._store.publish(generation, envelope, score, received_ns)
            except ProtocolError:
                self._increment("protocol")
            except (OSError, TimeoutError):
                pass
            finally:
                self._store.set_transport(generation, False, self._monotonic_ns())
                if transport is not None:
                    transport.close()
                self._clear_transport(transport)

            if self._stop_event.is_set():
                break
            delay = delays[min(backoff_index, len(delays) - 1)]
            backoff_index = min(backoff_index + 1, len(delays) - 1)
            self._stop_event.wait(delay + random.uniform(0, delay * 0.2))

    def stop(self, timeout_s=2.0):
        self._stop_event.set()
        with self._transport_lock:
            transport = self._transport
        if transport is not None:
            transport.close()
        if self.ident is not None and threading.current_thread() is not self:
            self.join(timeout_s)
        return not self.is_alive()

    def _validate_message(self, envelope, session_id):
        if envelope.device_id != self._expected_device_id:
            raise ProtocolError("message device ID changed")
        if envelope.session_id != session_id:
            raise ProtocolError("message session changed")

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
