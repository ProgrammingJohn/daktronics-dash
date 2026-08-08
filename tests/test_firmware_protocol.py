import subprocess
import unittest

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


if __name__ == "__main__":
    unittest.main()
