"""Configured TCP lifecycle for the DakDash connection protocol."""

import socket
import threading
from collections import deque

from services.connection.protocol import (
    Envelope,
    MessageType,
    PROTOCOL_VERSION,
    ProtocolError,
    TcpRecordDecoder,
    encode_tcp_record,
)


class ConnectionClosed(ConnectionError):
    """Raised when the peer closes the TCP stream cleanly."""


class TcpTransport:
    def __init__(self, sock, expected_device_id):
        self._socket = sock
        self._expected_device_id = expected_device_id
        self._decoder = TcpRecordDecoder()
        self._pending = deque()
        self._close_lock = threading.Lock()

    @classmethod
    def connect(cls, host, port, expected_device_id):
        sock = socket.create_connection((host, port), timeout=0.5)
        try:
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
        except BaseException:
            sock.close()
            raise
        return cls(sock, expected_device_id)

    @classmethod
    def from_socket(cls, sock, expected_device_id):
        return cls(sock, expected_device_id)

    def handshake(self, timeout_s):
        request = Envelope(
            PROTOCOL_VERSION,
            MessageType.CLIENT_HELLO,
            self._expected_device_id,
            "",
            0,
            0,
            0,
            0,
        )
        sock = self._require_socket()
        sock.settimeout(timeout_s)
        sock.sendall(encode_tcp_record(request))
        response = self.receive(timeout_s)
        if response.message_type is not MessageType.HELLO:
            raise ProtocolError("expected HELLO response")
        if response.protocol_version != PROTOCOL_VERSION:
            raise ProtocolError("unsupported protocol version")
        if response.device_id != self._expected_device_id:
            raise ProtocolError("unexpected device ID")
        return response

    def receive(self, timeout_s):
        if self._pending:
            return self._pending.popleft()
        sock = self._require_socket()
        sock.settimeout(timeout_s)
        while not self._pending:
            chunk = sock.recv(4096)
            if chunk == b"":
                raise ConnectionClosed("scoreboard connection closed")
            self._pending.extend(self._decoder.feed(chunk))
        return self._pending.popleft()

    def close(self):
        with self._close_lock:
            sock = self._socket
            self._socket = None
        if sock is None:
            return
        try:
            sock.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass
        sock.close()

    def _require_socket(self):
        with self._close_lock:
            sock = self._socket
        if sock is None:
            raise ConnectionClosed("scoreboard connection is closed")
        return sock
