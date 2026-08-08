"""Single-owner lifecycle for manual and synchronized scoreboard state."""

import threading
import time

from services.connection.protocol import Envelope
from services.connection.state_store import HealthState, LatestStateStore
from services.connection.supervisor import ConnectionSupervisor


class ScoreboardRuntime:
    def __init__(self):
        self._lock = threading.Lock()
        self._store = LatestStateStore()
        self._supervisor = None
        self._mode = None
        self._sport = None
        self._manual_generation = None
        self._manual_sequence = 0

    def start_synced(self, sport, host, port, expected_device_id):
        self.stop()
        supervisor = ConnectionSupervisor(
            sport, host, port, expected_device_id, self._store
        )
        with self._lock:
            self._mode = "synced"
            self._sport = sport
            self._supervisor = supervisor
            self._manual_generation = None
        supervisor.start()

    def start_manual(self, sport):
        self.stop()
        generation = self._store.start_generation()
        now_ns = time.monotonic_ns()
        self._store.set_transport(generation, True, now_ns)
        self._store.record_heartbeat(generation, now_ns)
        with self._lock:
            self._mode = "manual"
            self._sport = sport
            self._manual_generation = generation
            self._manual_sequence = 0

    def stop(self, timeout_s=2.0):
        with self._lock:
            supervisor = self._supervisor
            manual_generation = self._manual_generation
            self._supervisor = None
            self._manual_generation = None
            self._mode = None
            self._sport = None
        stopped = True
        if supervisor is not None:
            stopped = supervisor.stop(timeout_s)
        if manual_generation is not None:
            self._store.set_transport(
                manual_generation, False, time.monotonic_ns()
            )
        return stopped

    def update_manual(self, score):
        with self._lock:
            if self._mode != "manual" or self._manual_generation is None:
                return False
            generation = self._manual_generation
            self._manual_sequence += 1
            sequence = self._manual_sequence
        now_ns = time.monotonic_ns()
        envelope = Envelope.snapshot(
            device_id="manual",
            session_id="manual-{}".format(generation),
            packet_seq=sequence,
            state_seq=sequence,
            uptime_ms=now_ns // 1_000_000,
            serial_age_ms=0,
            payload=b"",
        )
        self._store.record_heartbeat(generation, now_ns)
        return self._store.publish(generation, envelope, score, now_ns)

    def is_running(self):
        with self._lock:
            return self._mode is not None

    def is_manual(self):
        with self._lock:
            return self._mode == "manual"

    def scoreboard_name(self):
        with self._lock:
            return self._sport

    def score(self):
        if not self.is_running():
            return None
        return dict(self._store.view(time.monotonic_ns()).score)

    def status(self):
        view = self._store.view(time.monotonic_ns())
        with self._lock:
            mode = self._mode
        return {
            "status": (
                view.health.value if mode is not None
                else HealthState.DISCONNECTED.value
            ),
            "transport": "manual" if mode == "manual" else "tcp",
            "source": "manual" if mode == "manual" else "daktronics",
            "revision": view.revision,
            "source_age_ms": view.source_age_ms,
        }


runtime = ScoreboardRuntime()
