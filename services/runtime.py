from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from services.config import BackendConfig
from services.esp32_client import Esp32Client
from services.models import CONTROL_MODES, SUPPORTED_SPORTS
from services.sport_parsers import SportParsers
from services.state_store import StateStore


class RuntimeManager:
    """Owns backend session lifecycle and mediates writes to StateStore."""

    def __init__(self, config: BackendConfig) -> None:
        self._config = config
        self._store = StateStore()
        self._manual_parsers = SportParsers()
        self._client: Optional[Esp32Client] = None
        self._logger = logging.getLogger(__name__)

    @property
    def store(self) -> StateStore:
        return self._store

    def start_session(
        self,
        *,
        sport: str,
        control_mode: str,
        esp_ip: Optional[str] = None,
        esp_port: Optional[int] = None,
    ) -> Dict[str, Any]:
        sport = sport.lower().strip()
        control_mode = control_mode.lower().strip()

        if sport not in SUPPORTED_SPORTS:
            raise ValueError(f"unsupported sport: {sport}")
        if control_mode not in CONTROL_MODES:
            raise ValueError(f"unsupported control mode: {control_mode}")

        if control_mode == "live":
            if not esp_ip:
                raise ValueError("esp_ip is required in live mode")
            if esp_port is None:
                raise ValueError("esp_port is required in live mode")

        self._stop_client()
        self._store.initialize_session(sport, control_mode, esp_ip=esp_ip, esp_port=esp_port)

        if control_mode == "live":
            self._start_client(sport=sport, esp_ip=esp_ip, esp_port=int(esp_port))

        return self.get_session()

    def stop_session(self) -> None:
        self._stop_client()
        self._store.stop_session()

    def get_session(self) -> Dict[str, Any]:
        return self._store.get_session()

    def get_state(self) -> Dict[str, Any]:
        return self._store.get_state()

    def get_connection(self) -> Dict[str, Any]:
        return self._store.get_connection()

    def set_control_mode(self, mode: str) -> Dict[str, Any]:
        mode = mode.lower().strip()
        if mode not in CONTROL_MODES:
            raise ValueError(f"unsupported control mode: {mode}")

        session = self._store.get_session()
        if session.get("sport") is None:
            raise ValueError("session is not started")

        self._store.set_control_mode(mode)

        connection = self._store.get_connection()
        sport = session["sport"]
        if mode == "live":
            esp_ip = connection.get("esp_ip")
            esp_port = connection.get("esp_port")
            if not esp_ip or not esp_port:
                raise ValueError("cannot switch to live mode without esp_ip and esp_port")
            if self._client is None or not self._client.is_alive():
                self._start_client(sport=sport, esp_ip=str(esp_ip), esp_port=int(esp_port))
        return self._store.get_state()

    def apply_manual_update(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        session = self._store.get_session()
        sport = session.get("sport")
        if not sport:
            raise ValueError("session is not started")

        parsed = self._manual_parsers.parse(sport, payload)
        return self._store.apply_manual_update(parsed)

    def health(self) -> Dict[str, Any]:
        connection = self._store.get_connection()
        session = self._store.get_session()
        return {
            "status": "ok",
            "session_running": bool(session.get("sport")),
            "sport": session.get("sport"),
            "control_mode": session.get("control_mode"),
            "connection_status": connection.get("status"),
            "protocol_mode": connection.get("protocol_mode"),
        }

    def _start_client(self, *, sport: str, esp_ip: str, esp_port: int) -> None:
        self._store.set_connection_target(esp_ip, esp_port)
        self._client = Esp32Client(
            config=self._config,
            store=self._store,
            sport=sport,
            ip=esp_ip,
            port=esp_port,
            logger=self._logger,
        )
        self._client.start()

    def _stop_client(self) -> None:
        if self._client is None:
            return
        self._client.stop()
        if self._client.is_alive():
            self._client.join(timeout=2)
        self._client = None
