import socket
import threading
import unittest

from services.connection.protocol import (
    Envelope,
    MessageType,
    PROTOCOL_VERSION,
    ProtocolError,
    TcpRecordDecoder,
    encode_tcp_record,
)
from services.connection.tcp_transport import ConnectionClosed, TcpTransport
from tests.test_protocol import snapshot


class TcpTransportTests(unittest.TestCase):
    def test_handshake_validates_device_and_preserves_coalesced_snapshot(self):
        client, server = socket.socketpair()
        transport = TcpTransport.from_socket(client, "wt32-aabbccddeeff")
        errors = []

        def device():
            try:
                decoder = TcpRecordDecoder()
                requests = []
                while not requests:
                    requests.extend(decoder.feed(server.recv(4096)))
                self.assertEqual(requests[0].message_type, MessageType.CLIENT_HELLO)
                hello = Envelope(
                    PROTOCOL_VERSION,
                    MessageType.HELLO,
                    "wt32-aabbccddeeff",
                    "boot-1",
                    1,
                    0,
                    100,
                    9999,
                )
                server.sendall(
                    encode_tcp_record(hello)
                    + encode_tcp_record(snapshot(1, b"frame", session_id="boot-1"))
                )
            except BaseException as error:
                errors.append(error)
            finally:
                server.close()

        worker = threading.Thread(target=device)
        worker.start()
        try:
            transport.handshake(timeout_s=1.0)
            self.assertEqual(transport.receive(timeout_s=1.0).payload, b"frame")
        finally:
            transport.close()
            worker.join()
        if errors:
            raise errors[0]

    def test_handshake_rejects_unexpected_device(self):
        client, server = socket.socketpair()
        transport = TcpTransport.from_socket(client, "expected-device")
        hello = Envelope(
            PROTOCOL_VERSION,
            MessageType.HELLO,
            "different-device",
            "boot-1",
            1,
            0,
            100,
            9999,
        )
        server.sendall(encode_tcp_record(hello))
        try:
            with self.assertRaisesRegex(ProtocolError, "device"):
                transport.handshake(timeout_s=1.0)
        finally:
            transport.close()
            server.close()

    def test_clean_eof_raises_connection_closed(self):
        client, server = socket.socketpair()
        transport = TcpTransport.from_socket(client, "wt32-aabbccddeeff")
        server.close()
        with self.assertRaises(ConnectionClosed):
            transport.receive(timeout_s=0.1)
        transport.close()

    def test_close_shuts_down_peer(self):
        client, server = socket.socketpair()
        transport = TcpTransport.from_socket(client, "wt32-aabbccddeeff")
        transport.close()
        server.settimeout(0.5)
        try:
            self.assertEqual(server.recv(1), b"")
        finally:
            server.close()


if __name__ == "__main__":
    unittest.main()
