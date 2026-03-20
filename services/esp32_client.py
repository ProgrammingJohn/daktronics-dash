from __future__ import annotations

import json
import logging
import socket
import threading
import time
from collections import deque
from typing import Any, Deque, Optional, Set

from services.config import BackendConfig
from services.models import now_iso
from services.sport_parsers import SportParsers
from services.state_store import StateStore


class Esp32Client(threading.Thread):
    """TCP client that connects to the ESP32 scoreboard bridge."""

    def __init__(
        self,
        *,
        config: BackendConfig,
        store: StateStore,
        sport: str,
        ip: str,
        port: int,
        logger: Optional[logging.Logger] = None,
    ) -> None:
        super().__init__(daemon=True)
        self._config = config
        self._store = store
        self._parsers = SportParsers()
        self._sport = sport
        self._ip = ip
        self._port = port
        self._logger = logger or logging.getLogger(__name__)

        self._stop_event = threading.Event()
        self._socket_lock = threading.Lock()
        self._socket: Optional[socket.socket] = None

        self._seq_history: Deque[str] = deque(maxlen=self._config.seq_cache_size)
        self._seq_set: Set[str] = set()

    def stop(self) -> None:
        self._stop_event.set()
        with self._socket_lock:
            if self._socket is not None:
                try:
                    self._socket.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass
                try:
                    self._socket.close()
                except OSError:
                    pass
                self._socket = None

    def run(self) -> None:
        reconnect_attempts = 0
        while not self._stop_event.is_set():
            reconnect_attempts += 1
            self._store.update_connection(
                status="connecting",
                reconnect_attempts=reconnect_attempts,
                last_error=None,
            )

            try:
                sock = socket.create_connection(
                    (self._ip, self._port),
                    timeout=self._config.tcp_connect_timeout_sec,
                )
                sock.settimeout(self._config.socket_timeout_sec)

                with self._socket_lock:
                    self._socket = sock

                self._store.update_connection(status="connected", last_error=None)
                self._store.touch_packet()
                self._consume_stream(sock)

            except OSError as exc:
                if self._stop_event.is_set():
                    break
                self._store.update_connection(status="disconnected", last_error=str(exc))
                self._logger.debug("ESP32 connection error: %s", exc)
            finally:
                with self._socket_lock:
                    if self._socket is not None:
                        try:
                            self._socket.close()
                        except OSError:
                            pass
                        self._socket = None

            if not self._stop_event.is_set():
                time.sleep(self._config.reconnect_delay_sec)

    def _consume_stream(self, sock: socket.socket) -> None:
        buffer = b""
        last_packet_monotonic = time.monotonic()

        while not self._stop_event.is_set():
            try:
                chunk = sock.recv(4096)
                if not chunk:
                    raise ConnectionError("socket closed by peer")
                last_packet_monotonic = time.monotonic()
                self._store.touch_packet()
                buffer += chunk

                buffer = self._process_legacy_frames(buffer)
                buffer = self._process_json_lines(buffer, sock)

                if len(buffer) > 65536:
                    buffer = buffer[-32768:]

            except socket.timeout:
                if time.monotonic() - last_packet_monotonic > self._config.stale_timeout_sec:
                    self._store.update_connection(status="stale", last_error="stale timeout")
                    return
            except (ConnectionError, OSError) as exc:
                if not self._stop_event.is_set():
                    self._store.update_connection(status="disconnected", last_error=str(exc))
                return

    def _process_legacy_frames(self, buffer: bytes) -> bytes:
        while True:
            start = buffer.find(b"\x01")
            if start < 0:
                break

            end = buffer.find(b"\x04", start + 1)
            if end < 0:
                if start > 0:
                    return buffer[start:]
                return buffer

            frame = buffer[start + 1 : end]
            buffer = buffer[end + 1 :]

            payload = frame.decode(errors="ignore")
            if not payload:
                continue

            self._store.update_connection(status="connected", protocol_mode="legacy", last_error=None)
            self._handle_live_payload(self._sport, payload, raw_source_data=payload, protocol_mode="legacy")

        return buffer

    def _process_json_lines(self, buffer: bytes, sock: socket.socket) -> bytes:
        while b"\n" in buffer:
            line, buffer = buffer.split(b"\n", 1)
            line = line.strip()
            if not line:
                continue

            try:
                packet = json.loads(line.decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue

            self._store.update_connection(status="connected", protocol_mode="json_v1", last_error=None)
            self._handle_json_packet(sock, packet)
        return buffer

    def _handle_json_packet(self, sock: socket.socket, packet: dict[str, Any]) -> None:
        msg_type = str(packet.get("type", "")).strip().lower()
        seq = packet.get("seq")
        seq_token = str(seq) if seq is not None else None

        if seq_token and self._is_duplicate(seq_token):
            self._send_ack(sock, seq, "ok", "duplicate")
            return

        if msg_type == "hello":
            device_id = packet.get("device_id")
            if isinstance(device_id, str) and device_id.strip():
                self._store.update_connection(device_id=device_id.strip())
            self._send_json(
                sock,
                {
                    "type": "hello_ack",
                    "protocol": "json_v1",
                    "server_time": now_iso(),
                },
            )
            self._send_ack(sock, seq, "ok", "hello accepted")
            return

        if msg_type == "heartbeat":
            self._send_ack(sock, seq, "ok", "heartbeat")
            return

        if msg_type == "data":
            payload_sport = str(packet.get("sport") or self._sport).strip().lower()
            payload = packet.get("payload")
            try:
                status = self._handle_live_payload(
                    payload_sport,
                    payload,
                    raw_source_data=packet,
                    protocol_mode="json_v1",
                )
            except ValueError as exc:
                self._send_ack(sock, seq, "error", str(exc))
                return

            message = "stored while manual mode" if status == "stored" else "applied"
            self._send_ack(sock, seq, status, message)
            return

        self._send_ack(sock, seq, "error", f"unsupported message type: {msg_type}")

    def _handle_live_payload(self, sport: str, payload: Any, *, raw_source_data: Any, protocol_mode: str) -> str:
        parsed = self._parsers.parse(sport, payload)
        status, _ = self._store.apply_live_update(
            parsed,
            raw_source_data=raw_source_data,
            protocol_mode=protocol_mode,
        )
        return status

    def _send_json(self, sock: socket.socket, payload: dict[str, Any]) -> None:
        wire = (json.dumps(payload, separators=(",", ":")) + "\n").encode("utf-8")
        sock.sendall(wire)

    def _send_ack(self, sock: socket.socket, seq: Any, status: str, message: str) -> None:
        self._send_json(
            sock,
            {
                "type": "ack",
                "seq": seq,
                "status": status,
                "message": message,
                "server_time": now_iso(),
            },
        )

    def _is_duplicate(self, seq: str) -> bool:
        if seq in self._seq_set:
            return True

        if len(self._seq_history) == self._seq_history.maxlen:
            oldest = self._seq_history.popleft()
            self._seq_set.discard(oldest)

        self._seq_history.append(seq)
        self._seq_set.add(seq)
        return False
