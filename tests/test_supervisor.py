import threading
import time
import unittest
from dataclasses import replace

from services.connection.protocol import (
    Envelope,
    MessageType,
    PROTOCOL_VERSION,
    ProtocolError,
)
from services.connection.state_store import HealthState, LatestStateStore
from services.connection.supervisor import ConnectionSupervisor
from tests.test_protocol import snapshot


class BlockingFakeTransport:
    def __init__(self, session_id="boot-1"):
        self.closed = False
        self.handshaken = threading.Event()
        self._session_id = session_id

    def handshake(self, timeout_s):
        self.handshaken.set()
        return Envelope(
            PROTOCOL_VERSION,
            MessageType.HELLO,
            "wt32-aabbccddeeff",
            self._session_id,
            1,
            0,
            100,
            9999,
        )

    def receive(self, timeout_s):
        if self.closed:
            raise OSError("closed")
        time.sleep(0.001)
        raise TimeoutError

    def close(self):
        self.closed = True


class SequenceFakeTransport(BlockingFakeTransport):
    def __init__(self, messages, session_id="boot-1"):
        super().__init__(session_id)
        self._messages = iter(messages)

    def receive(self, timeout_s):
        try:
            return next(self._messages)
        except StopIteration:
            return super().receive(timeout_s)


class ClosingSequenceFakeTransport(SequenceFakeTransport):
    def __init__(self, session_id, messages):
        super().__init__(messages)
        self._session_id = session_id

    def handshake(self, timeout_s):
        self.handshaken.set()
        return Envelope(
            PROTOCOL_VERSION,
            MessageType.HELLO,
            "wt32-aabbccddeeff",
            self._session_id,
            1,
            0,
            100,
            9999,
        )

    def receive(self, timeout_s):
        try:
            return next(self._messages)
        except StopIteration:
            raise OSError("peer closed")


class IncompatibleFakeTransport(BlockingFakeTransport):
    def handshake(self, timeout_s):
        self.handshaken.set()
        raise ProtocolError("unexpected device ID")


class FactorySequence:
    def __init__(self, transports):
        self._transports = list(transports)
        self.calls = 0

    def __call__(self, *args):
        index = min(self.calls, len(self._transports) - 1)
        self.calls += 1
        return self._transports[index]


class SupervisorTests(unittest.TestCase):
    def test_stop_closes_transport_and_joins_promptly(self):
        transport = BlockingFakeTransport()
        supervisor = ConnectionSupervisor(
            "football",
            "10.93.37.138",
            1234,
            "wt32-aabbccddeeff",
            LatestStateStore(),
            transport_factory=lambda *args: transport,
        )
        supervisor.start()
        self.assertTrue(transport.handshaken.wait(0.5))
        self.assertTrue(supervisor.stop(timeout_s=2.0))
        self.assertTrue(transport.closed)
        self.assertFalse(supervisor.is_alive())

    def test_valid_snapshot_publishes_and_malformed_snapshot_is_retained(self):
        good = snapshot(
            1,
            b"12:00HOME      GUEST     2233146311<>403339",
            session_id="boot-1",
        )
        bad = replace(snapshot(2, b"short", session_id="boot-1"), packet_seq=10)
        transport = SequenceFakeTransport([good, bad])
        store = LatestStateStore()
        supervisor = ConnectionSupervisor(
            "football",
            "10.93.37.138",
            1234,
            "wt32-aabbccddeeff",
            store,
            transport_factory=lambda *args: transport,
        )
        supervisor.start()
        deadline = time.monotonic() + 0.5
        while store.view(time.monotonic_ns()).revision < 1 and time.monotonic() < deadline:
            time.sleep(0.001)
        supervisor.stop()
        view = store.view(time.monotonic_ns())
        self.assertEqual(view.revision, 1)
        self.assertEqual(view.score["home_score"], 22)
        self.assertEqual(supervisor.parse_errors, 1)

    def test_heartbeat_keeps_connected_source_stale_without_snapshot(self):
        heartbeat = Envelope(
            PROTOCOL_VERSION,
            MessageType.HEARTBEAT,
            "wt32-aabbccddeeff",
            "boot-1",
            2,
            0,
            200,
            9999,
        )
        transport = SequenceFakeTransport([heartbeat])
        store = LatestStateStore()
        supervisor = ConnectionSupervisor(
            "football",
            "10.93.37.138",
            1234,
            "wt32-aabbccddeeff",
            store,
            transport_factory=lambda *args: transport,
        )
        supervisor.start()
        deadline = time.monotonic() + 0.5
        while store.view(time.monotonic_ns()).health is HealthState.WAITING_FOR_CLIENT and time.monotonic() < deadline:
            time.sleep(0.001)
        view = store.view(time.monotonic_ns())
        supervisor.stop()
        self.assertEqual(view.health, HealthState.STALE_SOURCE)

    def test_reconnect_accepts_same_session_then_new_boot_sequence(self):
        payload = b"12:00HOME      GUEST     2233146311<>403339"
        first = ClosingSequenceFakeTransport(
            "boot-1", [replace(snapshot(7, payload, "boot-1"), packet_seq=9)]
        )
        second = ClosingSequenceFakeTransport(
            "boot-1", [replace(snapshot(8, payload, "boot-1"), packet_seq=10)]
        )
        third = SequenceFakeTransport(
            [replace(snapshot(1, payload, "boot-2"), packet_seq=2)],
            session_id="boot-2",
        )
        factory = FactorySequence([first, second, third])
        store = LatestStateStore()
        supervisor = ConnectionSupervisor(
            "football", "10.93.37.138", 1234, "wt32-aabbccddeeff",
            store, transport_factory=factory,
        )
        supervisor.start()
        deadline = time.monotonic() + 2.0
        while store.view(time.monotonic_ns()).revision < 3 and time.monotonic() < deadline:
            time.sleep(0.005)
        supervisor.stop()
        view = store.view(time.monotonic_ns())
        self.assertEqual(view.revision, 3)
        self.assertEqual(view.session_id, "boot-2")
        self.assertEqual(view.state_seq, 1)

    def test_three_missed_heartbeats_force_reconnect(self):
        first = BlockingFakeTransport()
        second = BlockingFakeTransport()
        factory = FactorySequence([first, second])
        now = 0

        def advancing_clock():
            nonlocal now
            now += 1_100_000_000
            return now

        supervisor = ConnectionSupervisor(
            "football", "10.93.37.138", 1234, "wt32-aabbccddeeff",
            LatestStateStore(), transport_factory=factory,
            monotonic_ns=advancing_clock,
        )
        supervisor.start()
        deadline = time.monotonic() + 1.0
        while factory.calls < 2 and time.monotonic() < deadline:
            time.sleep(0.005)
        supervisor.stop()
        self.assertGreaterEqual(factory.calls, 2)

    def test_duplicate_packet_sequence_is_protocol_error(self):
        duplicate = Envelope(
            PROTOCOL_VERSION, MessageType.HEARTBEAT,
            "wt32-aabbccddeeff", "boot-1", 1, 0, 200, 9999,
        )
        transport = SequenceFakeTransport([duplicate])
        supervisor = ConnectionSupervisor(
            "football", "10.93.37.138", 1234, "wt32-aabbccddeeff",
            LatestStateStore(), transport_factory=lambda *args: transport,
        )
        supervisor.start()
        deadline = time.monotonic() + 0.5
        while supervisor.protocol_errors == 0 and time.monotonic() < deadline:
            time.sleep(0.005)
        supervisor.stop()
        self.assertEqual(supervisor.protocol_errors, 1)

    def test_handshake_identity_failure_is_incompatible(self):
        transport = IncompatibleFakeTransport()
        store = LatestStateStore()
        supervisor = ConnectionSupervisor(
            "football", "10.93.37.138", 1234, "wt32-aabbccddeeff",
            store, transport_factory=lambda *args: transport,
        )
        supervisor.start()
        deadline = time.monotonic() + 0.5
        while store.view(time.monotonic_ns()).health is not HealthState.INCOMPATIBLE and time.monotonic() < deadline:
            time.sleep(0.005)
        supervisor.stop()
        self.assertEqual(store.view(time.monotonic_ns()).health, HealthState.INCOMPATIBLE)


if __name__ == "__main__":
    unittest.main()
