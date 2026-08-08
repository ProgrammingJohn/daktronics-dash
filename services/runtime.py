"""Single-owner lifecycle for manual and synchronized scoreboard state."""

import threading
import time

from services.connection.protocol import Envelope
from services.connection.state_store import HealthState, LatestStateStore
from services.connection.supervisor import ConnectionSupervisor


class ScoreboardRuntime:
    def __init__(self, supervisor_factory=ConnectionSupervisor):
        self._lifecycle_lock = threading.Lock()
        self._lock = threading.Lock()
        self._supervisor_factory = supervisor_factory
        self._store = LatestStateStore()
        self._supervisor = None
        self._mode = None
        self._sport = None
        self._manual_generation = None
        self._manual_sequence = 0

    def start_synced(self, sport, host, port, expected_device_id):
        with self._lifecycle_lock:
            if not self._stop_locked():
                return False
            supervisor = self._supervisor_factory(
                sport, host, port, expected_device_id, self._store
            )
            with self._lock:
                self._mode = "synced"
                self._sport = sport
                self._supervisor = supervisor
                self._manual_generation = None
            supervisor.start()
            return True

    def start_manual(self, sport):
        with self._lifecycle_lock:
            if not self._stop_locked():
                return False
            generation = self._store.start_generation()
            now_ns = time.monotonic_ns()
            self._store.set_transport(generation, True, now_ns)
            self._store.record_heartbeat(generation, now_ns)
            with self._lock:
                self._mode = "manual"
                self._sport = sport
                self._manual_generation = generation
                self._manual_sequence = 0
            return True

    def stop(self, timeout_s=2.0):
        with self._lifecycle_lock:
            return self._stop_locked(timeout_s)

    def _stop_locked(self, timeout_s=2.0):
        with self._lock:
            supervisor = self._supervisor
            manual_generation = self._manual_generation
        if supervisor is not None:
            if not supervisor.stop(timeout_s):
                return False
        if manual_generation is not None:
            self._store.set_transport(
                manual_generation, False, time.monotonic_ns()
            )
        with self._lock:
            self._supervisor = None
            self._manual_generation = None
            self._mode = None
            self._sport = None
        return True

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
        return _plain_value(self._store.view(time.monotonic_ns()).score)

    def status(self):
        view = self._store.view(time.monotonic_ns())
        with self._lock:
            mode = self._mode
            supervisor = self._supervisor
        discovery = _idle_discovery()
        if supervisor is not None:
            discovery_status = getattr(supervisor, "discovery_status", None)
            if discovery_status is not None:
                discovery = discovery_status()
        return {
            "status": (
                HealthState.LIVE.value if mode == "manual"
                else view.health.value if mode is not None
                else HealthState.DISCONNECTED.value
            ),
            "transport": "manual" if mode == "manual" else "tcp",
            "source": "manual" if mode == "manual" else "daktronics",
            "revision": view.revision,
            "source_age_ms": view.source_age_ms,
            "discovery": discovery,
        }


runtime = ScoreboardRuntime()


def _idle_discovery():
    return {
        "phase": "IDLE",
        "active": False,
        "attempts": 0,
        "method": None,
        "requested_host": None,
        "resolved_host": None,
    }


def _plain_value(value):
    if hasattr(value, "items"):
        return {key: _plain_value(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [_plain_value(item) for item in value]
    return value
