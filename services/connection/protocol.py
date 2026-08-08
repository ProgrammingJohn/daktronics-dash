"""Version 1 DakDash connection-envelope codec and TCP record decoder."""

import base64
import json
import struct
import zlib
from dataclasses import dataclass, field, replace
from enum import Enum
from typing import Any, Dict


MAX_RECORD_BYTES = 4096
MAX_PAYLOAD_BYTES = 512
PROTOCOL_VERSION = 1


class MessageType(str, Enum):
    CLIENT_HELLO = "CLIENT_HELLO"
    HELLO = "HELLO"
    SNAPSHOT = "SNAPSHOT"
    HEARTBEAT = "HEARTBEAT"
    STATUS = "STATUS"
    DISCOVER = "DISCOVER"
    DISCOVER_RESPONSE = "DISCOVER_RESPONSE"
    SUBSCRIBE_UDP = "SUBSCRIBE_UDP"


class ProtocolError(ValueError):
    pass


@dataclass(frozen=True)
class Envelope:
    protocol_version: int
    message_type: MessageType
    device_id: str
    session_id: str
    packet_seq: int
    state_seq: int
    uptime_ms: int
    serial_age_ms: int
    payload: bytes = b""
    details: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def snapshot(cls, device_id, session_id, packet_seq, state_seq,
                 uptime_ms, serial_age_ms, payload):
        return cls(PROTOCOL_VERSION, MessageType.SNAPSHOT, device_id,
                   session_id, packet_seq, state_seq, uptime_ms,
                   serial_age_ms, payload)

    def with_session(self, session_id):
        return replace(self, session_id=session_id)

    def with_details(self, details):
        return replace(self, details=dict(details))


def encode_tcp_record(envelope: Envelope) -> bytes:
    """Encode an envelope as a length-prefixed TCP record."""
    body = _encode_envelope(envelope)
    return struct.pack("!I", len(body)) + body


def decode_envelope(body: bytes) -> Envelope:
    """Decode and validate a UTF-8 JSON protocol envelope body."""
    if not isinstance(body, bytes):
        raise ProtocolError("envelope body must be bytes")
    if len(body) > MAX_RECORD_BYTES:
        raise ProtocolError("record body exceeds 4096 bytes")
    try:
        document = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ProtocolError("invalid JSON envelope") from error
    if not isinstance(document, dict):
        raise ProtocolError("envelope must be a JSON object")

    protocol_version = _required_integer(document, "protocol_version")
    if protocol_version != PROTOCOL_VERSION:
        raise ProtocolError("unsupported protocol version")

    message_type = _message_type(document.get("message_type"))
    device_id = _required_string(document, "device_id")
    session_id = _required_string(document, "session_id")
    packet_seq = _nonnegative_integer(document, "packet_seq")
    state_seq = _nonnegative_integer(document, "state_seq")
    uptime_ms = _nonnegative_integer(document, "uptime_ms")
    serial_age_ms = _nonnegative_integer(document, "serial_age_ms")
    payload = _decode_payload(document)
    details = document.get("details", {})
    if not isinstance(details, dict):
        raise ProtocolError("details must be an object")

    return Envelope(
        protocol_version,
        message_type,
        device_id,
        session_id,
        packet_seq,
        state_seq,
        uptime_ms,
        serial_age_ms,
        payload,
        details,
    )


class TcpRecordDecoder:
    """Incrementally decode bounded length-prefixed TCP records."""

    def __init__(self):
        self._buffer = bytearray()

    def feed(self, chunk: bytes) -> list[Envelope]:
        if not isinstance(chunk, (bytes, bytearray, memoryview)):
            raise ProtocolError("TCP chunk must be bytes")
        incoming = memoryview(chunk)
        if len(self._buffer) < 4:
            header_bytes = min(4 - len(self._buffer), len(incoming))
            self._buffer.extend(incoming[:header_bytes])
            incoming = incoming[header_bytes:]
            if len(self._buffer) < 4:
                return []
        self._reject_oversized_announced_record()
        self._buffer.extend(incoming)
        messages = []
        while len(self._buffer) >= 4:
            body_length = self._reject_oversized_announced_record()
            record_length = 4 + body_length
            if len(self._buffer) < record_length:
                break
            body = bytes(self._buffer[4:record_length])
            del self._buffer[:record_length]
            messages.append(decode_envelope(body))
        return messages

    def _reject_oversized_announced_record(self):
        body_length = struct.unpack("!I", self._buffer[:4])[0]
        if body_length > MAX_RECORD_BYTES:
            self._buffer.clear()
            raise ProtocolError("record body exceeds 4096 bytes")
        return body_length


def _encode_envelope(envelope):
    if not isinstance(envelope, Envelope):
        raise ProtocolError("envelope must be an Envelope")
    _validate_envelope_fields(envelope)
    payload = bytes(envelope.payload)
    document = {
        "protocol_version": envelope.protocol_version,
        "message_type": envelope.message_type.value,
        "device_id": envelope.device_id,
        "session_id": envelope.session_id,
        "packet_seq": envelope.packet_seq,
        "state_seq": envelope.state_seq,
        "uptime_ms": envelope.uptime_ms,
        "serial_age_ms": envelope.serial_age_ms,
        "payload": base64.b64encode(payload).decode("ascii"),
        "payload_crc32": zlib.crc32(payload) & 0xffffffff,
        "details": envelope.details,
    }
    try:
        body = json.dumps(document, separators=(",", ":"), sort_keys=True).encode("utf-8")
    except (TypeError, ValueError) as error:
        raise ProtocolError("details must be JSON serializable") from error
    if len(body) > MAX_RECORD_BYTES:
        raise ProtocolError("record body exceeds 4096 bytes")
    return body


def _validate_envelope_fields(envelope):
    if envelope.protocol_version != PROTOCOL_VERSION or isinstance(envelope.protocol_version, bool):
        raise ProtocolError("unsupported protocol version")
    if not isinstance(envelope.message_type, MessageType):
        raise ProtocolError("unsupported message type")
    if not isinstance(envelope.device_id, str) or not isinstance(envelope.session_id, str):
        raise ProtocolError("device_id and session_id must be strings")
    for name in ("packet_seq", "state_seq", "uptime_ms", "serial_age_ms"):
        value = getattr(envelope, name)
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ProtocolError(f"{name} must be a non-negative integer")
    if not isinstance(envelope.payload, bytes):
        raise ProtocolError("payload must be bytes")
    if len(envelope.payload) > MAX_PAYLOAD_BYTES:
        raise ProtocolError("payload exceeds 512 bytes")
    if not isinstance(envelope.details, dict):
        raise ProtocolError("details must be an object")


def _required_string(document, name):
    value = document.get(name)
    if not isinstance(value, str):
        raise ProtocolError(f"{name} must be a string")
    return value


def _required_integer(document, name):
    if name not in document:
        raise ProtocolError(f"missing {name}")
    value = document[name]
    if isinstance(value, bool) or not isinstance(value, int):
        raise ProtocolError(f"{name} must be an integer")
    return value


def _nonnegative_integer(document, name):
    value = _required_integer(document, name)
    if value < 0:
        raise ProtocolError(f"{name} must be non-negative")
    return value


def _message_type(value):
    if not isinstance(value, str):
        raise ProtocolError("message_type must be a string")
    try:
        return MessageType(value)
    except ValueError as error:
        raise ProtocolError("unsupported message type") from error


def _decode_payload(document):
    encoded_payload = document.get("payload")
    if not isinstance(encoded_payload, str):
        raise ProtocolError("payload must be a Base64 string")
    try:
        payload = base64.b64decode(encoded_payload.encode("ascii"), validate=True)
    except (UnicodeEncodeError, ValueError) as error:
        raise ProtocolError("invalid Base64 payload") from error
    if len(payload) > MAX_PAYLOAD_BYTES:
        raise ProtocolError("payload exceeds 512 bytes")
    expected_crc = _required_integer(document, "payload_crc32")
    if not 0 <= expected_crc <= 0xffffffff:
        raise ProtocolError("payload_crc32 must be a 32-bit unsigned integer")
    if zlib.crc32(payload) & 0xffffffff != expected_crc:
        raise ProtocolError("payload CRC mismatch")
    return payload
