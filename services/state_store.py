from __future__ import annotations

import threading
import time
from typing import Any, Dict, Optional, Tuple

from services.models import base_state, deep_copy_state, now_iso


class StateStore:
    """Thread-safe in-memory source of truth for scoreboard and connection state."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._sport: Optional[str] = None
        self._control_mode: str = "manual"

        initial = base_state("football", "manual")
        self._active_state: Dict[str, Any] = deep_copy_state(initial)
        self._live_state: Dict[str, Any] = deep_copy_state(initial)
        self._manual_state: Dict[str, Any] = deep_copy_state(initial)

        self._connection: Dict[str, Any] = {
            "status": "stopped",
            "protocol_mode": None,
            "esp_ip": None,
            "esp_port": None,
            "last_packet_time": None,
            "last_error": None,
            "device_id": None,
            "reconnect_attempts": 0,
        }

    def _merge(self, target: Dict[str, Any], patch: Dict[str, Any]) -> Dict[str, Any]:
        for key, value in patch.items():
            if isinstance(value, dict) and isinstance(target.get(key), dict):
                nested = dict(target[key])
                nested.update(value)
                target[key] = nested
            else:
                target[key] = value
        return target

    def initialize_session(
        self,
        sport: str,
        control_mode: str,
        esp_ip: Optional[str] = None,
        esp_port: Optional[int] = None,
    ) -> None:
        with self._lock:
            self._sport = sport
            self._control_mode = control_mode

            self._live_state = base_state(sport, control_mode)
            self._manual_state = base_state(sport, control_mode)
            self._active_state = deep_copy_state(self._live_state if control_mode == "live" else self._manual_state)

            self._connection.update(
                {
                    "status": "connecting" if control_mode == "live" else "manual",
                    "protocol_mode": None,
                    "esp_ip": esp_ip,
                    "esp_port": esp_port,
                    "last_packet_time": None,
                    "last_error": None,
                    "device_id": None,
                    "reconnect_attempts": 0,
                }
            )
            self._active_state["connection_status"] = self._connection["status"]
            self._active_state["control_mode"] = control_mode

    def stop_session(self) -> None:
        with self._lock:
            self._sport = None
            self._control_mode = "manual"

            reset = base_state("football", "manual")
            self._live_state = deep_copy_state(reset)
            self._manual_state = deep_copy_state(reset)
            self._active_state = deep_copy_state(reset)

            self._connection.update(
                {
                    "status": "stopped",
                    "protocol_mode": None,
                    "esp_ip": None,
                    "esp_port": None,
                    "last_packet_time": None,
                    "last_error": None,
                    "device_id": None,
                    "reconnect_attempts": 0,
                }
            )

    def set_control_mode(self, mode: str) -> None:
        with self._lock:
            self._control_mode = mode
            if mode == "live":
                self._active_state = deep_copy_state(self._live_state)
                if self._connection["status"] == "manual":
                    self._connection["status"] = "disconnected"
            else:
                self._active_state = deep_copy_state(self._manual_state)
                if self._connection["status"] == "stopped":
                    self._connection["status"] = "manual"
            self._active_state["control_mode"] = mode
            self._active_state["connection_status"] = self._connection["status"]

    def update_connection(
        self,
        *,
        status: Optional[str] = None,
        protocol_mode: Optional[str] = None,
        last_error: Optional[str] = None,
        device_id: Optional[str] = None,
        reconnect_attempts: Optional[int] = None,
    ) -> None:
        with self._lock:
            if status is not None:
                self._connection["status"] = status
                self._active_state["connection_status"] = status
            if protocol_mode is not None:
                self._connection["protocol_mode"] = protocol_mode
            if last_error is not None:
                self._connection["last_error"] = last_error
            if device_id is not None:
                self._connection["device_id"] = device_id
            if reconnect_attempts is not None:
                self._connection["reconnect_attempts"] = reconnect_attempts

    def touch_packet(self) -> None:
        with self._lock:
            self._connection["last_packet_time"] = now_iso()

    def mark_stale_if_needed(self, stale_timeout_sec: float) -> bool:
        with self._lock:
            if self._connection["status"] != "connected":
                return False
            last_packet = self._connection.get("last_packet_time")
            if not last_packet:
                return False
            last_ts = time.mktime(time.strptime(last_packet[:19], "%Y-%m-%dT%H:%M:%S"))
            now_ts = time.time()
            if now_ts - last_ts > stale_timeout_sec:
                self._connection["status"] = "stale"
                self._active_state["connection_status"] = "stale"
                return True
            return False

    def apply_live_update(
        self,
        patch: Dict[str, Any],
        *,
        raw_source_data: Any,
        protocol_mode: str,
    ) -> Tuple[str, Dict[str, Any]]:
        with self._lock:
            update = dict(patch)
            update["source"] = "esp32"
            update["raw_source_data"] = raw_source_data
            update["last_update_time"] = now_iso()
            update["control_mode"] = self._control_mode
            update["connection_status"] = self._connection["status"]

            self._merge(self._live_state, update)
            self._live_state["sport"] = self._sport or patch.get("sport")
            self._live_state["control_mode"] = self._control_mode

            self.touch_packet()
            self._connection["protocol_mode"] = protocol_mode

            if self._control_mode == "live":
                self._active_state = deep_copy_state(self._live_state)
                return "ok", deep_copy_state(self._active_state)

            return "stored", deep_copy_state(self._active_state)

    def apply_manual_update(self, patch: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            if self._control_mode != "manual":
                raise RuntimeError("manual_updates_disabled")
            update = dict(patch)
            update["source"] = "manual"
            update["raw_source_data"] = patch
            update["last_update_time"] = now_iso()
            update["control_mode"] = self._control_mode
            update["connection_status"] = self._connection["status"]

            self._merge(self._manual_state, update)
            self._manual_state["sport"] = self._sport or patch.get("sport")
            self._active_state = deep_copy_state(self._manual_state)
            return deep_copy_state(self._active_state)

    def set_connection_target(self, esp_ip: Optional[str], esp_port: Optional[int]) -> None:
        with self._lock:
            self._connection["esp_ip"] = esp_ip
            self._connection["esp_port"] = esp_port

    def get_state(self) -> Dict[str, Any]:
        with self._lock:
            return deep_copy_state(self._active_state)

    def get_live_state(self) -> Dict[str, Any]:
        with self._lock:
            return deep_copy_state(self._live_state)

    def get_manual_state(self) -> Dict[str, Any]:
        with self._lock:
            return deep_copy_state(self._manual_state)

    def get_connection(self) -> Dict[str, Any]:
        with self._lock:
            return dict(self._connection)

    def get_session(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "sport": self._sport,
                "control_mode": self._control_mode,
                "connection": dict(self._connection),
            }
