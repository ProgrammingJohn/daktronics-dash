import json
import struct
import unittest

from services.connection.protocol import (
    Envelope,
    MessageType,
    ProtocolError,
    TcpRecordDecoder,
    decode_envelope,
    encode_datagram,
    encode_tcp_record,
)


def snapshot(state_seq=7, payload=b"12:00HOME", session_id="boot-1234"):
    return Envelope.snapshot(
        device_id="wt32-aabbccddeeff",
        session_id=session_id,
        packet_seq=9,
        state_seq=state_seq,
        uptime_ms=2500,
        serial_age_ms=4,
        payload=payload,
    )


class TrackingBuffer(bytearray):
    def __init__(self):
        super().__init__()
        self.maximum_length = 0

    def extend(self, source):
        super().extend(source)
        self.maximum_length = max(self.maximum_length, len(self))


class ProtocolTests(unittest.TestCase):
    def test_split_and_coalesced_records_round_trip(self):
        first = encode_tcp_record(snapshot(7, b"first"))
        second = encode_tcp_record(snapshot(8, b"second"))
        decoder = TcpRecordDecoder()
        self.assertEqual(decoder.feed(first[:3]), [])
        messages = decoder.feed(first[3:] + second)
        self.assertEqual([message.state_seq for message in messages], [7, 8])
        self.assertEqual([message.payload for message in messages], [b"first", b"second"])

    def test_udp_datagram_round_trips_without_tcp_length_prefix(self):
        datagram = encode_datagram(snapshot(7, b"udp"))
        self.assertEqual(datagram[:1], b"{")
        decoded = decode_envelope(datagram)
        self.assertEqual(decoded.state_seq, 7)
        self.assertEqual(decoded.payload, b"udp")

    def test_rejects_oversized_record_before_buffering_body(self):
        decoder = TcpRecordDecoder()
        with self.assertRaisesRegex(ProtocolError, "4096"):
            decoder.feed(struct.pack("!I", 4097))

    def test_rejects_coalesced_oversized_body_before_buffering_it(self):
        valid_record = encode_tcp_record(snapshot(payload=b"valid"))
        oversized_record = struct.pack("!I", 4097) + b"x" * 4097
        decoder = TcpRecordDecoder()
        tracking_buffer = TrackingBuffer()
        decoder._buffer = tracking_buffer

        with self.assertRaisesRegex(ProtocolError, "4096"):
            decoder.feed(valid_record + oversized_record)

        self.assertEqual(tracking_buffer.maximum_length, len(valid_record))

    def test_rejects_payload_crc_mismatch(self):
        body = json.loads(encode_tcp_record(snapshot())[4:])
        body["payload_crc32"] ^= 1
        encoded_body = json.dumps(body, separators=(",", ":"), sort_keys=True).encode("utf-8")
        record = struct.pack("!I", len(encoded_body)) + encoded_body

        with self.assertRaisesRegex(ProtocolError, "CRC mismatch"):
            TcpRecordDecoder().feed(record)

    def test_deeply_nested_json_is_reported_as_protocol_error(self):
        body = ("[" * 1000 + "0" + "]" * 1000).encode()
        with self.assertRaises(ProtocolError):
            decode_envelope(body)


if __name__ == "__main__":
    unittest.main()
