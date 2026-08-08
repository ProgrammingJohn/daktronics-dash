from pathlib import Path
import unittest


SKETCH = Path("transmission/ESP/tcp_oled")
ADAPTERS = (
    "network_manager.h",
    "network_manager.cpp",
    "connection_server.h",
    "connection_server.cpp",
    "display_controller.h",
    "display_controller.cpp",
    "discovery_responder.h",
    "discovery_responder.cpp",
)


class FirmwareSourceContractTests(unittest.TestCase):
    def test_nonblocking_adapter_files_exist(self):
        missing = [name for name in ADAPTERS if not (SKETCH / name).is_file()]
        self.assertEqual(missing, [])

    def test_application_code_has_no_delays_or_uart_diagnostics(self):
        sources = [SKETCH / "tcp_oled.ino"] + [SKETCH / name for name in ADAPTERS]
        combined = "\n".join(path.read_text() for path in sources if path.exists())
        self.assertNotIn("delay(", combined)
        self.assertNotIn("Serial.print", combined)

    def test_loop_drains_uart_before_network_connection_and_display_ticks(self):
        source = (SKETCH / "tcp_oled.ino").read_text()
        serial = source.index("while (Serial.available())")
        network = source.index("network_manager.tick")
        connection = source.index("connection_server.tick")
        display = source.index("display_controller.tick")
        self.assertLess(serial, network)
        self.assertLess(network, connection)
        self.assertLess(connection, display)


if __name__ == "__main__":
    unittest.main()
