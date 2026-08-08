# Host Connection Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and test the Python-side versioned TCP connection, canonical scoreboard state, health model, and diagnostics API without changing browser/UI files.

**Architecture:** A bounded protocol decoder feeds validated envelopes into sport parsers and a generation-safe latest-state store. A cancellable supervisor owns TCP lifecycle and reconnect behavior; Flask routes access it through a runtime object rather than imported mutable globals.

**Tech Stack:** Python 3.9 standard library (`dataclasses`, `enum`, `json`, `socket`, `threading`, `unittest`, `zlib`), Flask 3.1.x.

## Global Constraints

- TCP port remains `1234`; protocol version is `1`.
- TCP records use a 4-byte network-order length prefix and a UTF-8 JSON body no larger than 4,096 bytes.
- Snapshot payloads decode to at most 512 bytes and must pass CRC32 validation.
- Preserve the last valid score through timeout, malformed input, or disconnect.
- One active ESP32 connection and one active service generation are supported.
- No files under `static/`, `templates/`, or `scoreboard_svgs/` may change.
- UDP and discovery are implemented in the later UDP-shadow plan, not this plan.
- Use `python3 -m unittest` for all automated tests; add no Python package dependency.

---

## File Map

- Create `services/connection/protocol.py`: envelope model, JSON codec, CRC validation, and TCP record decoder.
- Create `services/connection/state_store.py`: immutable snapshots, health states, counters, and generation guard.
- Create `services/connection/tcp_transport.py`: socket configuration, handshake, reads, writes, and prompt closure.
- Create `services/connection/supervisor.py`: reconnect loop, cancellation, parsing, and publication.
- Create `services/connection/__init__.py`: public connection interfaces.
- Create `services/sport_parsers.py`: validated sport parsing and canonical numeric types.
- Create `services/runtime.py`: owns manual/synced service lifecycle.
- Modify `services/service_service.py`: retain SVG/preferences functions and re-export compatibility names only.
- Modify `routes/api.py`: call the runtime and expose stable status/diagnostics payloads.
- Create `tests/`: standard-library unit and integration tests.

### Task 1: Protocol Envelope and Bounded TCP Decoder

**Files:**
- Create: `services/connection/__init__.py`
- Create: `services/connection/protocol.py`
- Create: `tests/__init__.py`
- Create: `tests/test_protocol.py`

**Interfaces:**
- Produces: `MessageType`, `Envelope`, `ProtocolError`, `encode_tcp_record(envelope) -> bytes`, `decode_envelope(body) -> Envelope`, and `TcpRecordDecoder.feed(chunk) -> list[Envelope]`.
- Consumes: no project interfaces.

- [ ] **Step 1: Write protocol round-trip and stream-boundary tests**

```python
# tests/test_protocol.py
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
        self.assertEqual([m.state_seq for m in messages], [7, 8])
        self.assertEqual([m.payload for m in messages], [b"first", b"second"])

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
```

- [ ] **Step 2: Run the tests and verify the missing-module failure**

Run: `python3 -m unittest tests.test_protocol -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'services.connection'`.

- [ ] **Step 3: Implement the protocol model and decoder**

Use these exact public definitions in `services/connection/protocol.py`:

```python
from dataclasses import dataclass, field, replace

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
```

Serialize with `json.dumps(..., separators=(",", ":"), sort_keys=True)`, Base64, and `zlib.crc32(payload) & 0xffffffff`. Reject booleans where integers are required, negative sequence/time fields, unsupported versions/types, decoded payloads over 512 bytes, invalid Base64, and CRC mismatch. `TcpRecordDecoder` keeps a `bytearray`, consumes zero-to-many complete records, and raises immediately when the announced body exceeds 4,096 bytes.

- [ ] **Step 4: Run the focused tests**

Run: `python3 -m unittest tests.test_protocol -v`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit the protocol unit**

```bash
git add services/connection/__init__.py services/connection/protocol.py tests/__init__.py tests/test_protocol.py
git commit -m "Add versioned connection protocol codec"
```

### Task 2: Generation-Safe Latest-State and Health Model

**Files:**
- Create: `services/connection/state_store.py`
- Create: `tests/test_state_store.py`

**Interfaces:**
- Consumes: `Envelope` from Task 1.
- Produces: `HealthState`, `StateView`, and `LatestStateStore` with `start_generation()`, `set_transport()`, `record_heartbeat()`, `publish()`, and `view()`.

- [ ] **Step 1: Write state retention, ordering, generation, and health tests**

```python
# tests/test_state_store.py
import unittest
from services.connection.protocol import Envelope
from services.connection.state_store import HealthState, LatestStateStore
from tests.test_protocol import snapshot


class StateStoreTests(unittest.TestCase):
    def test_rejects_old_generation_and_out_of_order_state(self):
        store = LatestStateStore()
        old = store.start_generation()
        current = store.start_generation()
        self.assertFalse(store.publish(old, snapshot(1), {"home_score": 1}, 1_000_000_000))
        self.assertTrue(store.publish(current, snapshot(2), {"home_score": 2}, 2_000_000_000))
        self.assertFalse(store.publish(current, snapshot(1), {"home_score": 1}, 3_000_000_000))
        self.assertEqual(store.view(3_000_000_000).score["home_score"], 2)

    def test_disconnect_retains_last_good_score(self):
        store = LatestStateStore()
        generation = store.start_generation()
        store.set_transport(generation, True, 0)
        store.publish(generation, snapshot(1), {"home_score": 22}, 0)
        store.set_transport(generation, False, 1_000_000_000)
        view = store.view(1_000_000_000)
        self.assertEqual(view.health, HealthState.DISCONNECTED)
        self.assertEqual(view.score, {"home_score": 22})

    def test_live_then_stale_source_then_disconnected(self):
        store = LatestStateStore(source_stale_ns=2_000_000_000,
                                 heartbeat_timeout_ns=3_000_000_000)
        generation = store.start_generation()
        store.set_transport(generation, True, 0)
        store.record_heartbeat(generation, 0)
        store.publish(generation, snapshot(1), {"home_score": 1}, 0)
        self.assertEqual(store.view(1_000_000_000).health, HealthState.LIVE)
        self.assertEqual(store.view(2_500_000_000).health, HealthState.STALE_SOURCE)
        self.assertEqual(store.view(3_500_000_000).health, HealthState.DISCONNECTED)
```

- [ ] **Step 2: Run and verify the missing-module failure**

Run: `python3 -m unittest tests.test_state_store -v`

Expected: FAIL importing `services.connection.state_store`.

- [ ] **Step 3: Implement immutable views and locked mutations**

Define:

```python
class HealthState(str, Enum):
    LIVE = "LIVE"
    STALE_SOURCE = "STALE_SOURCE"
    WAITING_FOR_CLIENT = "WAITING_FOR_CLIENT"
    DISCONNECTED = "DISCONNECTED"
    INCOMPATIBLE = "INCOMPATIBLE"

@dataclass(frozen=True)
class StateView:
    score: Mapping[str, Any]
    revision: int
    health: HealthState
    device_id: Optional[str]
    session_id: Optional[str]
    state_seq: Optional[int]
    received_ns: Optional[int]
    source_age_ms: Optional[int]
    counters: Mapping[str, int]
```

Use `threading.Lock`, `MappingProxyType(dict(score))`, and a monotonically increasing generation. `publish` accepts only the current generation/session and strictly newer `state_seq`. `view` computes health without mutating stored data. Increment counters named `published`, `old_generation`, `out_of_order`, and `disconnects`.

- [ ] **Step 4: Run state and protocol tests**

Run: `python3 -m unittest tests.test_protocol tests.test_state_store -v`

Expected: 6 tests PASS.

- [ ] **Step 5: Commit state storage**

```bash
git add services/connection/state_store.py tests/test_state_store.py
git commit -m "Add latest-state health store"
```

### Task 3: Canonical Sport Parsers

**Files:**
- Create: `services/sport_parsers.py`
- Create: `tests/test_sport_parsers.py`
- Modify: `services/synced_service.py`

**Interfaces:**
- Produces: `parse_scoreboard_frame(sport: str, payload: bytes) -> Dict[str, Any]`.
- Consumes: validated payload bytes from Task 1.

- [ ] **Step 1: Write golden parser tests for every sport**

```python
# tests/test_sport_parsers.py
import unittest
from services.sport_parsers import FrameParseError, parse_scoreboard_frame


class SportParserTests(unittest.TestCase):
    def test_football_uses_numeric_types_and_ui_compatible_keys(self):
        score = parse_scoreboard_frame(
            "football", b"12:00HOME      GUEST     2233146311<>403339"
        )
        self.assertEqual(score["clock"], {"minutes": 12, "seconds": 0})
        self.assertEqual(score["home_score"], 22)
        self.assertEqual(score["away_score"], 33)
        self.assertEqual(score["yards_to_go"], 11)
        self.assertIs(score["home_possesion"], True)

    def test_basketball_frame(self):
        chars = list(" " * 29)
        chars[0:5] = "12:00"
        chars[12:15] = " 22"
        chars[15:18] = " 33"
        chars[18:20] = " 5"
        chars[20:22] = " 4"
        chars[24] = "3"
        chars[27] = "2"
        chars[28] = "1"
        score = parse_scoreboard_frame("basketball", "".join(chars).encode())
        self.assertEqual(score["clock"], {"minutes": 12, "seconds": 0})
        self.assertEqual((score["home_score"], score["away_score"]), (22, 33))
        self.assertIs(score["away_bonus"], True)

    def test_baseball_frame(self):
        score = parse_scoreboard_frame("baseball", b"4,3,7,top,2,1,1,1,0,1")
        self.assertEqual(score["inning_text"], "top 7")
        self.assertEqual(score["strikes_and_balls"], "1 - 2")
        self.assertEqual((score["base_one"], score["base_two"], score["base_three"]),
                         (True, False, True))

    def test_truncated_frame_is_rejected(self):
        with self.assertRaises(FrameParseError):
            parse_scoreboard_frame("basketball", b"12:00")
```

- [ ] **Step 2: Run and verify the missing-module failure**

Run: `python3 -m unittest tests.test_sport_parsers -v`

Expected: FAIL importing `services.sport_parsers`.

- [ ] **Step 3: Move parsing into a validated module**

Implement `FrameParseError(ValueError)`, strict ASCII decoding, exact minimum lengths for fixed-width sports, integer conversion through a helper that supplies documented sport defaults only for blank fields, and the existing baseball CSV field count. Preserve `home_possesion` for current browser compatibility and rename football `yards` to `yards_to_go`. Replace `RtdParser` in `services/synced_service.py` with a compatibility wrapper that calls `parse_scoreboard_frame` so no duplicate parser remains.

- [ ] **Step 4: Run parser and protocol tests**

Run: `python3 -m unittest tests.test_sport_parsers tests.test_protocol -v`

Expected: 7 tests PASS.

- [ ] **Step 5: Commit parser normalization**

```bash
git add services/sport_parsers.py services/synced_service.py tests/test_sport_parsers.py
git commit -m "Normalize synced sport parsing"
```

### Task 4: TCP Transport and Handshake

**Files:**
- Create: `services/connection/tcp_transport.py`
- Create: `tests/test_tcp_transport.py`

**Interfaces:**
- Consumes: Task 1 codec.
- Produces: `TcpTransport.connect(host, port, expected_device_id)`, `from_socket(sock, expected_device_id)`, `receive(timeout_s)`, and `close()`.

- [ ] **Step 1: Write socket-pair handshake, receive, EOF, and close tests**

```python
# tests/test_tcp_transport.py
import socket
import threading
import unittest
from services.connection.protocol import (
    Envelope, MessageType, PROTOCOL_VERSION, TcpRecordDecoder,
    encode_tcp_record,
)
from tests.test_protocol import snapshot
from services.connection.tcp_transport import ConnectionClosed, TcpTransport


class TcpTransportTests(unittest.TestCase):
    def test_handshake_validates_device_and_receives_snapshot(self):
        client, server = socket.socketpair()
        transport = TcpTransport.from_socket(client, "wt32-aabbccddeeff")

        def device():
            decoder = TcpRecordDecoder()
            requests = []
            while not requests:
                requests.extend(decoder.feed(server.recv(4096)))
            request = requests[0]
            self.assertEqual(request.message_type, MessageType.CLIENT_HELLO)
            hello = Envelope(PROTOCOL_VERSION, MessageType.HELLO,
                "wt32-aabbccddeeff", "boot-1", 1, 0, 100, 9999)
            server.sendall(encode_tcp_record(hello))
            server.sendall(encode_tcp_record(snapshot(1, b"frame", session_id="boot-1")))

        worker = threading.Thread(target=device)
        worker.start()
        transport.handshake(timeout_s=1.0)
        self.assertEqual(transport.receive(timeout_s=1.0).payload, b"frame")
        transport.close()
        worker.join()

    def test_clean_eof_raises_connection_closed(self):
        client, server = socket.socketpair()
        transport = TcpTransport.from_socket(client, "wt32-aabbccddeeff")
        server.close()
        with self.assertRaises(ConnectionClosed):
            transport.receive(timeout_s=0.1)
```

- [ ] **Step 2: Run and verify the missing-module failure**

Run: `python3 -m unittest tests.test_tcp_transport -v`

Expected: FAIL importing `services.connection.tcp_transport`.

- [ ] **Step 3: Implement configured TCP lifecycle**

Set connect timeout to 2 seconds, `TCP_NODELAY=1`, `SO_KEEPALIVE=1`, and receive timeout per call. `handshake` sends `CLIENT_HELLO`, requires `HELLO`, protocol version 1, and exact expected device ID. Preserve extra envelopes received in the same socket chunk in an internal `deque`. Treat `recv() == b""` as `ConnectionClosed`. `close()` must call `shutdown(SHUT_RDWR)` and suppress only `OSError` before closing.

- [ ] **Step 4: Run the transport suite**

Run: `python3 -m unittest tests.test_protocol tests.test_tcp_transport -v`

Expected: 5 tests PASS.

- [ ] **Step 5: Commit TCP transport**

```bash
git add services/connection/tcp_transport.py tests/test_tcp_transport.py
git commit -m "Add cancellable TCP scoreboard transport"
```

### Task 5: Supervisor, Runtime, and Diagnostics API

**Files:**
- Create: `services/connection/supervisor.py`
- Create: `services/runtime.py`
- Create: `tests/test_supervisor.py`
- Create: `tests/test_api.py`
- Modify: `services/service_service.py`
- Modify: `routes/api.py`

**Interfaces:**
- Consumes: `TcpTransport`, `parse_scoreboard_frame`, and `LatestStateStore`.
- Produces: singleton `runtime`, `ConnectionSupervisor.start()`, `stop(timeout_s=2.0)`, and stable Flask JSON responses.

- [ ] **Step 1: Write supervisor cancellation and stale-generation tests**

```python
# tests/test_supervisor.py
import unittest
from services.connection.state_store import LatestStateStore
from services.connection.supervisor import ConnectionSupervisor


class BlockingFakeTransport:
    def __init__(self):
        self.closed = False
    def handshake(self, timeout_s):
        return None
    def receive(self, timeout_s):
        if self.closed:
            raise OSError("closed")
        raise TimeoutError
    def close(self):
        self.closed = True


class SupervisorTests(unittest.TestCase):
    def test_stop_closes_transport_and_joins_promptly(self):
        transport = BlockingFakeTransport()
        supervisor = ConnectionSupervisor(
            "football", "10.93.37.138", 1234, "wt32-aabbccddeeff",
            LatestStateStore(), transport_factory=lambda *args: transport,
        )
        supervisor.start()
        self.assertTrue(supervisor.stop(timeout_s=2.0))
        self.assertTrue(transport.closed)
        self.assertFalse(supervisor.is_alive())
```

- [ ] **Step 2: Write Flask lifecycle and diagnostics tests**

```python
# tests/test_api.py
import unittest
from main import app


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_status_has_stable_connection_shape(self):
        response = self.client.get("/api/scoreboard-service/status")
        self.assertEqual(response.status_code, 200)
        required = {"status", "transport", "source", "revision", "source_age_ms"}
        self.assertLessEqual(required, set(response.get_json()))

    def test_score_without_service_is_explicit(self):
        response = self.client.get("/api/scoreboard-service/get-score")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["error"], "Scoreboard service is not running")
```

- [ ] **Step 3: Run and verify failures against the old global runtime**

Run: `python3 -m unittest tests.test_supervisor tests.test_api -v`

Expected: FAIL because `ConnectionSupervisor` and the stable response shape do not exist.

- [ ] **Step 4: Implement supervisor and runtime ownership**

`ConnectionSupervisor` must:

```python
class ConnectionSupervisor(threading.Thread):
    def __init__(self, sport, host, port, expected_device_id, store,
                 transport_factory=TcpTransport.connect,
                 monotonic_ns=time.monotonic_ns): ...
    def stop(self, timeout_s=2.0) -> bool: ...
```

It starts a new store generation, handshakes, handles `SNAPSHOT` and `HEARTBEAT`, parses only validated snapshots, records parse/protocol errors without publishing defaults, closes its socket during stop, and retries with delays `0.25, 0.5, 1, 2, 5` seconds plus up to 20% jitter. A successful handshake resets backoff.

`ScoreboardRuntime` owns one lock, one `LatestStateStore`, and one optional supervisor. `start_synced` stops the previous generation before starting another; `stop` is bounded; manual updates publish through a manual generation. Export one `runtime = ScoreboardRuntime()`.

- [ ] **Step 5: Replace imported `active_thread` route state**

In `routes/api.py`, import `runtime` and route all start/stop/status/score operations through it. Keep existing endpoint paths. Return the current flat score dictionary from `get-score` for browser compatibility. Return connection diagnostics from `status` using exactly:

```json
{
  "status": "DISCONNECTED",
  "transport": "tcp",
  "source": "daktronics",
  "revision": 0,
  "source_age_ms": null
}
```

Do not edit JavaScript or templates. Keep SVG loading and preference functions in `service_service.py`; remove the connection thread/global state from that file.

- [ ] **Step 6: Run the complete host suite**

Run: `python3 -m unittest discover -s tests -v`

Expected: all tests PASS with no live ESP32 required.

- [ ] **Step 7: Compile Python sources**

Run: `python3 -m compileall main.py routes services tests`

Expected: exit 0 with every listed source compiled.

- [ ] **Step 8: Commit host integration**

```bash
git add services/connection/supervisor.py services/runtime.py services/service_service.py routes/api.py tests/test_supervisor.py tests/test_api.py
git commit -m "Integrate supervised scoreboard connections"
```

## Plan Completion Gate

Run both commands from a clean task branch:

```bash
python3 -m unittest discover -s tests -v
python3 -m compileall main.py routes services tests
```

Record the test count and commit hashes. Do not start firmware protocol changes until this suite passes.
