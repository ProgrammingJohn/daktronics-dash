import struct
import unittest

from services.connection.protocol import (
    Envelope,
    MessageType,
    ProtocolError,
    TcpRecordDecoder,
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


class ProtocolTests(unittest.TestCase):
    def test_split_and_coalesced_records_round_trip(self):
        first = encode_tcp_record(snapshot(7, b"first"))
        second = encode_tcp_record(snapshot(8, b"second"))
        decoder = TcpRecordDecoder()
        self.assertEqual(decoder.feed(first[:3]), [])
        messages = decoder.feed(first[3:] + second)
        self.assertEqual([message.state_seq for message in messages], [7, 8])
        self.assertEqual([message.payload for message in messages], [b"first", b"second"])

    def test_rejects_oversized_record_before_buffering_body(self):
        decoder = TcpRecordDecoder()
        with self.assertRaisesRegex(ProtocolError, "4096"):
            decoder.feed(struct.pack("!I", 4097))

    def test_rejects_payload_crc_mismatch(self):
        record = bytearray(encode_tcp_record(snapshot()))
        record[-8] ^= 1
        with self.assertRaises(ProtocolError):
            TcpRecordDecoder().feed(bytes(record))


if __name__ == "__main__":
    unittest.main()
