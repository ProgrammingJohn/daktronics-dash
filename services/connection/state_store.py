"""Thread-safe latest-score state and connection health snapshots."""

from dataclasses import dataclass
from enum import Enum
from threading import Lock
from types import MappingProxyType
from typing import Any, Mapping, Optional

from services.connection.protocol import Envelope


class HealthState(str, Enum):
    LIVE = "LIVE"
    STALE_SOURCE = "STALE_SOURCE"
    WAITING_FOR_CLIENT = "WAITING_FOR_CLIENT"
    DISCONNECTED = "DISCONNECTED"
    INCOMPATIBLE = "INCOMPATIBLE"


@dataclass(frozen=True)
class StateView:
    score: Mapping[str, Any]
    revision: int
    health: HealthState
    device_id: Optional[str]
    session_id: Optional[str]
    state_seq: Optional[int]
    received_ns: Optional[int]
    source_age_ms: Optional[int]
    counters: Mapping[str, int]


class LatestStateStore:
    """Retain the newest valid score from the active connection generation."""

    def __init__(self, source_stale_ns=2_000_000_000,
                 heartbeat_timeout_ns=3_000_000_000):
        self._source_stale_ns = source_stale_ns
        self._heartbeat_timeout_ns = heartbeat_timeout_ns
        self._lock = Lock()
        self._generation = 0
        self._generation_session_id = None
        self._transport_connected = False
        self._transport_seen = False
        self._heartbeat_ns = None
        self._score = {}
        self._revision = 0
        self._device_id = None
        self._session_id = None
        self._state_seq = None
        self._received_ns = None
        self._serial_age_ms = None
        self._published_generation = None
        self._incompatible = False
        self._counters = {
            "published": 0,
            "old_generation": 0,
            "out_of_order": 0,
            "disconnects": 0,
        }

    def start_generation(self):
        with self._lock:
            self._generation += 1
            self._generation_session_id = None
            self._transport_connected = False
            self._transport_seen = False
            self._heartbeat_ns = None
            self._state_seq = None
            self._incompatible = False
            return self._generation

    def set_transport(self, generation, connected, received_ns):
        with self._lock:
            if not self._is_current_generation(generation):
                return False
            if self._transport_connected and not connected:
                self._counters["disconnects"] += 1
            self._transport_connected = connected
            self._transport_seen = True
            return True

    def record_heartbeat(self, generation, received_ns):
        with self._lock:
            if not self._is_current_generation(generation):
                return False
            self._heartbeat_ns = received_ns
            return True

    def mark_incompatible(self, generation):
        with self._lock:
            if not self._is_current_generation(generation):
                return False
            self._transport_connected = False
            self._transport_seen = True
            self._incompatible = True
            return True

    def publish(self, generation, envelope: Envelope, score, received_ns):
        with self._lock:
            if not self._is_current_generation(generation):
                return False
            if self._generation_session_id is None:
                self._generation_session_id = envelope.session_id
            elif envelope.session_id != self._generation_session_id:
                self._counters["old_generation"] += 1
                return False
            if self._state_seq is not None and envelope.state_seq <= self._state_seq:
                self._counters["out_of_order"] += 1
                return False
            self._score = _freeze_mapping(score)
            self._revision += 1
            self._device_id = envelope.device_id
            self._session_id = envelope.session_id
            self._state_seq = envelope.state_seq
            self._received_ns = received_ns
            self._serial_age_ms = envelope.serial_age_ms
            self._published_generation = generation
            self._counters["published"] += 1
            return True

    def view(self, now_ns):
        with self._lock:
            source_age_ms = self._source_age_ms(now_ns)
            return StateView(
                score=MappingProxyType(dict(self._score)),
                revision=self._revision,
                health=self._health(now_ns, source_age_ms),
                device_id=self._device_id,
                session_id=self._session_id,
                state_seq=self._state_seq,
                received_ns=self._received_ns,
                source_age_ms=source_age_ms,
                counters=MappingProxyType(dict(self._counters)),
            )

    def _is_current_generation(self, generation):
        if generation == self._generation:
            return True
        self._counters["old_generation"] += 1
        return False

    def _source_age_ms(self, now_ns):
        if self._received_ns is None:
            return None
        elapsed_ns = max(0, now_ns - self._received_ns)
        return elapsed_ns // 1_000_000 + self._serial_age_ms

    def _health(self, now_ns, source_age_ms):
        if self._incompatible:
            return HealthState.INCOMPATIBLE
        if not self._transport_connected:
            if self._transport_seen:
                return HealthState.DISCONNECTED
            return HealthState.WAITING_FOR_CLIENT
        if self._heartbeat_ns is None:
            return HealthState.WAITING_FOR_CLIENT
        if now_ns - self._heartbeat_ns >= self._heartbeat_timeout_ns:
            return HealthState.DISCONNECTED
        if self._published_generation != self._generation:
            return HealthState.STALE_SOURCE
        if self._received_ns is None:
            return HealthState.STALE_SOURCE
        if source_age_ms * 1_000_000 >= self._source_stale_ns:
            return HealthState.STALE_SOURCE
        return HealthState.LIVE


def _freeze_mapping(mapping):
    return MappingProxyType({key: _freeze_value(value) for key, value in mapping.items()})


def _freeze_value(value):
    if isinstance(value, Mapping):
        return _freeze_mapping(value)
    if isinstance(value, list):
        return tuple(_freeze_value(item) for item in value)
    if isinstance(value, tuple):
        return tuple(_freeze_value(item) for item in value)
    return value
