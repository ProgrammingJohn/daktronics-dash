from __future__ import annotations

import json
import socket
import threading
import time
import unittest
from unittest import mock

from services.config import BackendConfig
from services.esp32_client import Esp32Client
from services.state_store import StateStore


class Esp32ClientTests(unittest.TestCase):
    def test_json_protocol_ack_and_dedup(self) -> None:
        server_sock, client_sock = socket.socketpair()
        acks = []

        def esp32_server() -> None:
            with server_sock:
                server_sock.settimeout(2.0)
                packets = [
                    {
                        "type": "hello",
                        "seq": 1,
                        "protocol": "json_v1",
                        "device_id": "esp-test",
                        "sport": "basketball",
                        "timestamp": time.time(),
                    },
                    {
                        "type": "data",
                        "seq": 2,
                        "sport": "basketball",
                        "payload": {"home_score": 11, "away_score": 6, "clock": "1:05"},
                        "timestamp": time.time(),
                    },
                    {
                        "type": "data",
                        "seq": 2,
                        "sport": "basketball",
                        "payload": {"home_score": 99, "away_score": 99},
                        "timestamp": time.time(),
                    },
                ]
                for packet in packets:
                    server_sock.sendall((json.dumps(packet) + "\n").encode("utf-8"))

                buffer = b""
                deadline = time.time() + 2
                while time.time() < deadline:
                    try:
                        chunk = server_sock.recv(2048)
                    except socket.timeout:
                        break
                    if not chunk:
                        break
                    buffer += chunk

                for line in buffer.splitlines():
                    try:
                        acks.append(json.loads(line.decode("utf-8")))
                    except json.JSONDecodeError:
                        continue

        server_thread = threading.Thread(target=esp32_server, daemon=True)
        server_thread.start()

        config = BackendConfig(socket_timeout_sec=0.2, reconnect_delay_sec=0.2, stale_timeout_sec=1.0)
        store = StateStore()
        store.initialize_session("basketball", "live", esp_ip="127.0.0.1", esp_port=1234)

        client = Esp32Client(config=config, store=store, sport="basketball", ip="127.0.0.1", port=1234)
        with mock.patch("services.esp32_client.socket.create_connection", return_value=client_sock):
            client.start()

            deadline = time.time() + 3
            while time.time() < deadline:
                if store.get_live_state().get("home_score") == 11:
                    break
                time.sleep(0.05)

            client.stop()
            client.join(timeout=2)
            server_thread.join(timeout=2)

        state = store.get_live_state()
        self.assertEqual(state["home_score"], 11)
        self.assertEqual(state["away_score"], 6)

        ack_types = [ack.get("type") for ack in acks]
        self.assertIn("hello_ack", ack_types)
        self.assertGreaterEqual(sum(1 for ack in acks if ack.get("type") == "ack"), 2)


if __name__ == "__main__":
    unittest.main()
