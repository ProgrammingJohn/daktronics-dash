import subprocess
import unittest
from pathlib import Path

from services.connection.protocol import MessageType, decode_envelope


class FirmwareProtocolTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run(
            [
                "clang++",
                "-std=c++17",
                "-Itransmission/ESP/tcp_oled",
                "-I/Users/exterkamp/Documents/Arduino/libraries/ArduinoJson/src",
                "tests/firmware/protocol_vector.cpp",
                "transmission/ESP/tcp_oled/connection_protocol.cpp",
                "transmission/ESP/tcp_oled/serial_pipeline.cpp",
                "-o",
                "/tmp/dakdash_protocol_vector",
            ],
            check=True,
        )
        stack_report = Path("/tmp/dakdash_connection_protocol.su")
        stack_report.unlink(missing_ok=True)
        subprocess.run(
            [
                "clang++",
                "-std=c++17",
                "-fstack-usage",
                "-Itransmission/ESP/tcp_oled",
                "-I/Users/exterkamp/Documents/Arduino/libraries/ArduinoJson/src",
                "-c",
                "transmission/ESP/tcp_oled/connection_protocol.cpp",
                "-o",
                "/tmp/dakdash_connection_protocol.o",
            ],
            check=True,
        )

    def test_cpp_snapshot_decodes_with_python_codec(self):
        body = subprocess.check_output(["/tmp/dakdash_protocol_vector"])
        envelope = decode_envelope(body)
        self.assertEqual(envelope.message_type, MessageType.SNAPSHOT)
        self.assertEqual(envelope.device_id, "wt32-aabbccddeeff")
        self.assertEqual(envelope.session_id, "boot-1234")
        self.assertEqual(envelope.state_seq, 7)
        self.assertEqual(envelope.payload, b"12:00HOME")

    def test_cpp_heartbeat_carries_health_metrics(self):
        body = subprocess.check_output(
            ["/tmp/dakdash_protocol_vector", "heartbeat"]
        )
        envelope = decode_envelope(body)
        self.assertEqual(envelope.message_type, MessageType.HEARTBEAT)
        self.assertEqual(envelope.payload, b"")
        self.assertEqual(envelope.details["uart_bytes"], 100)
        self.assertEqual(envelope.details["tcp_write_failures"], 5)

    def test_cpp_hello_decodes_with_python_codec(self):
        body = subprocess.check_output(["/tmp/dakdash_protocol_vector", "hello"])
        envelope = decode_envelope(body)
        self.assertEqual(envelope.message_type, MessageType.HELLO)
        self.assertEqual(envelope.device_id, "wt32-aabbccddeeff")
        self.assertEqual(envelope.session_id, "boot-1234")

    def test_cpp_decoder_reads_expected_device_from_client_hello(self):
        device_id = subprocess.check_output(
            ["/tmp/dakdash_protocol_vector", "decode"], text=True
        )
        self.assertEqual(device_id, "wt32-aabbccddeeff")

    def test_cpp_discovery_response_decodes_with_python_codec(self):
        body = subprocess.check_output(
            ["/tmp/dakdash_protocol_vector", "discover-response"]
        )
        envelope = decode_envelope(body)
        self.assertEqual(envelope.message_type, MessageType.DISCOVER_RESPONSE)
        self.assertEqual(envelope.device_id, "wt32-aabbccddeeff")
        self.assertEqual(envelope.details, {
            "nonce": "0011223344556677",
            "ip": "10.93.37.138",
            "port": 1234,
        })

    def test_cpp_discovery_decoder_accepts_python_contract(self):
        nonce = subprocess.check_output(
            ["/tmp/dakdash_protocol_vector", "decode-discover"], text=True
        )
        self.assertEqual(nonce, "0011223344556677")

    def test_protocol_codec_stack_usage_is_bounded(self):
        report = Path("/tmp/dakdash_connection_protocol.su").read_text()
        functions = (
            "encode_snapshot_json",
            "encode_hello_json",
            "encode_heartbeat_json",
            "decode_client_hello",
            "encode_discover_response_json",
            "decode_discover_json",
        )
        for function in functions:
            line = next(line for line in report.splitlines() if function in line)
            stack_bytes = int(line.split("\t")[1])
            self.assertLessEqual(stack_bytes, 1024, function)


if __name__ == "__main__":
    unittest.main()
