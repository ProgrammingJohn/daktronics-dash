# Bounded Discovery and UDP Shadow Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add restrained startup discovery and measure unicast UDP against authoritative TCP on the wired school LAN, with automatic TCP fallback and a reproducible transport report.

**Architecture:** Direct TCP to the reserved address remains first. After failure, the host checks the passive ARP cache and then sends at most three UDP discovery probes within 500 ms; after TCP handshake it negotiates a UDP destination and receives matching shadow snapshots while continuing to publish TCP state.

**Tech Stack:** Python 3.9 standard library UDP sockets/statistics/JSONL, ESP32 `WiFiUDP`, existing protocol-v1 JSON codec, `unittest`, Arduino CLI, and wired bench fixtures.

## Global Constraints

- Complete both the host-foundation and ESP32-TCP plans before this plan.
- Live UDP is unicast to the negotiated Mac address/port; it is never broadcast.
- Discovery checks passive ARP first, sends at most three probes within 500 ms, and then stops.
- The DHCP-reserved address and manual IP entry remain functional fallbacks.
- TCP stays connected and authoritative throughout shadow testing.
- Accept UDP only for the active TCP-negotiated `device_id`, `session_id`, and nonce.
- UDP datagrams remain below 1,200 bytes and carry complete protocol envelopes.
- No UI implementation; create only a handoff prompt for the UI agent.

---

## File Map

- Create `services/connection/discovery.py`: bounded discovery client.
- Create `services/connection/udp_shadow.py`: receiver and session validation.
- Create `services/connection/transport_metrics.py`: matched TCP/UDP comparison.
- Modify `services/connection/protocol.py`: enable discovery fields and UDP nonce validation.
- Modify `services/connection/tcp_transport.py`: send `SUBSCRIBE_UDP`.
- Modify `services/connection/supervisor.py`: direct-first discovery fallback and shadow recording.
- Modify `transmission/ESP/tcp_oled/connection_protocol.*`: discovery/subscription messages.
- Create `transmission/ESP/tcp_oled/discovery_responder.*`: bounded unicast response.
- Create `transmission/ESP/tcp_oled/udp_shadow_sender.*`: negotiated unicast sender.
- Modify `transmission/ESP/tcp_oled/tcp_oled.ino`: tick the new adapters.
- Create `scripts/transport_soak.py` and `scripts/report_transport_metrics.py`.
- Create `docs/operations/udp-shadow-test.md` and `docs/handoffs/connection-ui-prompt.md`.

### Task 1: Bounded Host Discovery

**Files:**
- Create: `services/connection/discovery.py`
- Create: `tests/test_discovery.py`
- Modify: `services/connection/protocol.py`

**Interfaces:**
- Consumes: protocol `Envelope`, `MessageType.DISCOVER`, and `MessageType.DISCOVER_RESPONSE`.
- Produces: `DiscoveryResult` and `DiscoveryClient.discover(expected_device_id) -> Optional[DiscoveryResult]`.

- [ ] **Step 1: Write exact-attempt, nonce, identity, and timeout tests**

```python
# tests/test_discovery.py
import unittest
from services.connection.discovery import DiscoveryClient


class FakeDatagramSocket:
    def __init__(self, responses):
        self.responses = list(responses)
        self.sent = []
    def setsockopt(self, *args):
        pass
    def settimeout(self, value):
        self.timeout = value
    def sendto(self, data, address):
        self.sent.append((data, address))
    def recvfrom(self, size):
        if not self.responses:
            raise TimeoutError
        return self.responses.pop(0)
    def close(self):
        pass


class DiscoveryTests(unittest.TestCase):
    def test_stops_after_exactly_three_unanswered_probes(self):
        sock = FakeDatagramSocket([])
        client = DiscoveryClient(socket_factory=lambda: sock,
                                 nonce_factory=lambda: "0011223344556677")
        self.assertIsNone(client.discover("wt32-aabbccddeeff"))
        self.assertEqual(len(sock.sent), 3)
        self.assertEqual({address for _, address in sock.sent},
                         {("255.255.255.255", 1234)})

    def test_ignores_wrong_nonce_and_device_then_accepts_match(self):
        wrong_nonce = DiscoveryClient.response_bytes(
            "wt32-aabbccddeeff", "other", "10.93.37.138", 1234)
        wrong_device = DiscoveryClient.response_bytes(
            "wt32-other", "0011223344556677", "10.93.37.139", 1234)
        match = DiscoveryClient.response_bytes(
            "wt32-aabbccddeeff", "0011223344556677", "10.93.37.138", 1234)
        sock = FakeDatagramSocket([
            (wrong_nonce, ("10.93.37.138", 1234)),
            (wrong_device, ("10.93.37.139", 1234)),
            (match, ("10.93.37.138", 1234)),
        ])
        result = DiscoveryClient(socket_factory=lambda: sock,
            nonce_factory=lambda: "0011223344556677").discover("wt32-aabbccddeeff")
        self.assertEqual((result.host, result.port), ("10.93.37.138", 1234))
```

- [ ] **Step 2: Run and verify the missing-module failure**

Run: `python3 -m unittest tests.test_discovery -v`

Expected: FAIL importing `services.connection.discovery`.

- [ ] **Step 3: Implement three bounded probes**

Define:

```python
@dataclass(frozen=True)
class DiscoveryResult:
    host: str
    port: int
    device_id: str

class DiscoveryClient:
    def __init__(self, socket_factory, nonce_factory=default_nonce,
                 attempts=3, total_timeout_s=0.5, port=1234): ...
    def discover(self, expected_device_id: str) -> Optional[DiscoveryResult]: ...
```

Derive the ESP Ethernet MAC from `wt32-<12 hex>` and check `arp -an` before opening UDP. If passive lookup misses, enable `SO_BROADCAST`, send to `255.255.255.255:1234`, use a fresh 16-hex-character nonce per call, and close the socket in `finally`. Divide one 500 ms deadline across at most three attempts. Ignore malformed, wrong-version, wrong-type, wrong-device, wrong-nonce, non-unicast-address, and invalid-port replies. Return immediately on the first match; never run a background retry loop.

- [ ] **Step 4: Run discovery and protocol tests**

Run: `python3 -m unittest tests.test_discovery tests.test_protocol -v`

Expected: all tests PASS.

- [ ] **Step 5: Commit host discovery**

```bash
git add services/connection/discovery.py services/connection/protocol.py tests/test_discovery.py
git commit -m "Add bounded scoreboard discovery"
```

### Task 2: Rate-Limited ESP32 Discovery Response

**Files:**
- Create: `transmission/ESP/tcp_oled/discovery_responder.h`
- Create: `transmission/ESP/tcp_oled/discovery_responder.cpp`
- Create: `tests/firmware/test_discovery_protocol.cpp`
- Modify: `transmission/ESP/tcp_oled/connection_protocol.h`
- Modify: `transmission/ESP/tcp_oled/connection_protocol.cpp`
- Modify: `transmission/ESP/tcp_oled/tcp_oled.ino`

**Interfaces:**
- Consumes: UDP `DISCOVER` envelope, local device ID/IP, and protocol codec.
- Produces: one unicast `DISCOVER_RESPONSE` to the request source.

- [ ] **Step 1: Add pure codec tests for discovery validation**

The C++ test must assert that `decode_discover` accepts protocol version 1, a 16-character hexadecimal nonce, and either an empty or matching expected device ID. It must reject an incorrect device ID, nonce length, message type, and version. It must assert that the encoded response echoes the nonce and contains `10.93.37.138`, port `1234`, and `wt32-aabbccddeeff`.

- [ ] **Step 2: Run and verify failure before implementation**

Run:

```bash
clang++ -std=c++17 -Itransmission/ESP/tcp_oled -I/Users/exterkamp/Documents/Arduino/libraries/ArduinoJson/src tests/firmware/test_discovery_protocol.cpp transmission/ESP/tcp_oled/connection_protocol.cpp -o /tmp/dakdash_discovery_protocol_test
```

Expected: FAIL because discovery codec interfaces are missing.

- [ ] **Step 3: Implement bounded responder behavior**

`DiscoveryResponder` binds UDP port `1234` only after DHCP is ready. `tick()` reads at most one datagram per loop, rejects datagrams over 1,200 bytes, validates the envelope and expected identity, and replies to `remoteIP()/remotePort()` only. Enforce a minimum 250 ms response interval and a maximum of three responses in any rolling three-second window. Reset its socket after link or DHCP-address changes. It must never send unless it first receives a valid request.

- [ ] **Step 4: Run C++ tests and Arduino compile**

Run:

```bash
clang++ -std=c++17 -Itransmission/ESP/tcp_oled -I/Users/exterkamp/Documents/Arduino/libraries/ArduinoJson/src tests/firmware/test_discovery_protocol.cpp transmission/ESP/tcp_oled/connection_protocol.cpp -o /tmp/dakdash_discovery_protocol_test
/tmp/dakdash_discovery_protocol_test
arduino-cli compile --fqbn esp32:esp32:esp32 transmission/ESP/tcp_oled
```

Expected: both commands exit 0 and firmware remains under the resource limits from the firmware plan.

- [ ] **Step 5: Commit discovery firmware**

```bash
git add transmission/ESP/tcp_oled/discovery_responder.h transmission/ESP/tcp_oled/discovery_responder.cpp transmission/ESP/tcp_oled/connection_protocol.h transmission/ESP/tcp_oled/connection_protocol.cpp transmission/ESP/tcp_oled/tcp_oled.ino tests/firmware/test_discovery_protocol.cpp
git commit -m "Add rate-limited ESP32 discovery"
```

### Task 3: UDP Shadow Receiver and Matched Transport Metrics

**Files:**
- Create: `services/connection/udp_shadow.py`
- Create: `services/connection/transport_metrics.py`
- Create: `tests/test_udp_shadow.py`
- Create: `tests/test_transport_metrics.py`
- Modify: `services/connection/tcp_transport.py`

**Interfaces:**
- Produces: `UdpShadowReceiver`, `TransportComparator.record(transport, envelope, received_ns)`, `summary()`, and `write_jsonl()`.
- Consumes: active TCP device/session identity and negotiated nonce.

- [ ] **Step 1: Write UDP session-validation tests**

```python
# tests/test_udp_shadow.py
import unittest
from services.connection.udp_shadow import UdpShadowReceiver
from tests.test_protocol import snapshot


class UdpShadowTests(unittest.TestCase):
    def test_accepts_only_negotiated_session_nonce_and_new_sequence(self):
        receiver = UdpShadowReceiver.for_test(
            device_id="wt32-aabbccddeeff", session_id="boot-1",
            nonce="0011223344556677"
        )
        valid = snapshot(8, b"new").with_session("boot-1").with_details(
            {"udp_nonce": "0011223344556677"})
        self.assertEqual(receiver.validate(valid).state_seq, 8)
        self.assertIsNone(receiver.validate(valid))
        self.assertIsNone(receiver.validate(valid.with_session("boot-old")))
```

Use the immutable `Envelope.with_session()` and `with_details()` helpers defined in Task 1 of the host plan.

- [ ] **Step 2: Write matched-arrival metrics tests**

```python
# tests/test_transport_metrics.py
import unittest
from services.connection.transport_metrics import TransportComparator
from tests.test_protocol import snapshot


class TransportMetricsTests(unittest.TestCase):
    def test_matches_state_and_reports_udp_arrival_delta(self):
        metrics = TransportComparator(max_samples=100)
        message = snapshot(10, b"same")
        metrics.record("tcp", message, 1_000_000_000)
        metrics.record("udp", message, 900_000_000)
        summary = metrics.summary()
        self.assertEqual(summary["matched_states"], 1)
        self.assertEqual(summary["udp_lead_ms_p50"], 100.0)
        self.assertEqual(summary["tcp_gaps"], 0)
        self.assertEqual(summary["udp_gaps"], 0)
```

- [ ] **Step 3: Run and verify missing-module failures**

Run: `python3 -m unittest tests.test_udp_shadow tests.test_transport_metrics -v`

Expected: FAIL importing both new modules.

- [ ] **Step 4: Implement bounded UDP receive and metrics**

`UdpShadowReceiver` binds `0.0.0.0:0`, exposes its assigned port and random nonce, sets a 500 ms timeout, decodes one complete envelope per datagram, and validates device/session/nonce/CRC before sequence filtering. It records rejects by reason and stops by closing its socket.

`TransportComparator` retains at most `max_samples` state keys in insertion order. Track received, gaps, duplicates, reordering, first/last receive time, longest inter-arrival blackout, and matched TCP/UDP arrival delta. Compute p50/p95/p99 with a deterministic nearest-rank helper; return `None` when no sample supports a metric. JSONL rows contain monotonic receive time, transport, device/session, packet/state sequences, payload CRC, and reject reason.

- [ ] **Step 5: Add TCP subscription send**

Add `TcpTransport.send(envelope)` using `sendall(encode_tcp_record(envelope))` under a write lock. Add `subscribe_udp(port, nonce)` that sends `SUBSCRIBE_UDP` for the active device/session with `details={"port": port, "udp_nonce": nonce}` and rejects ports outside 1024–65535 or non-hex/incorrect-length nonces.

- [ ] **Step 6: Run the connection suite**

Run: `python3 -m unittest discover -s tests -v`

Expected: all tests PASS.

- [ ] **Step 7: Commit UDP host primitives**

```bash
git add services/connection/udp_shadow.py services/connection/transport_metrics.py services/connection/tcp_transport.py tests/test_udp_shadow.py tests/test_transport_metrics.py tests/test_protocol.py
git commit -m "Add UDP shadow receiver metrics"
```

### Task 4: Negotiated ESP32 UDP Shadow Sender

**Files:**
- Create: `transmission/ESP/tcp_oled/udp_shadow_sender.h`
- Create: `transmission/ESP/tcp_oled/udp_shadow_sender.cpp`
- Create: `tests/firmware/test_udp_subscription.cpp`
- Modify: `transmission/ESP/tcp_oled/connection_protocol.h`
- Modify: `transmission/ESP/tcp_oled/connection_protocol.cpp`
- Modify: `transmission/ESP/tcp_oled/connection_server.cpp`
- Modify: `transmission/ESP/tcp_oled/tcp_oled.ino`

**Interfaces:**
- Consumes: validated `SUBSCRIBE_UDP`, active TCP remote IP, session ID, and encoded snapshot/heartbeat.
- Produces: matching unicast UDP datagrams carrying the same state/session identity as TCP.

- [ ] **Step 1: Write subscription validation tests**

The host C++ test encodes subscription inputs and asserts acceptance only when message type, device ID, session ID, port `1024..65535`, and 16-character hex nonce all match. It asserts rejection for a stale session, wrong device, low port, oversized datagram, and malformed nonce.

- [ ] **Step 2: Compile and verify failure**

Run:

```bash
clang++ -std=c++17 -Itransmission/ESP/tcp_oled -I/Users/exterkamp/Documents/Arduino/libraries/ArduinoJson/src tests/firmware/test_udp_subscription.cpp transmission/ESP/tcp_oled/connection_protocol.cpp -o /tmp/dakdash_udp_subscription_test
```

Expected: FAIL because subscription decoding is absent.

- [ ] **Step 3: Implement TCP-bound UDP negotiation**

The sender accepts subscription only from the active TCP client. Ignore any host field in JSON; destination IP comes from `WiFiClient.remoteIP()`. Store port, nonce, device ID, and session ID. Clear subscription immediately on TCP disconnect, reboot/session change, link loss, or DHCP-address change.

- [ ] **Step 4: Send identical shadow records**

For each new snapshot, encode one JSON envelope containing `details.udp_nonce`, prepend its length only for TCP, and send the identical JSON body as one UDP datagram. Send the once-per-second heartbeat over both paths after subscription. Check `beginPacket`, `write`, and `endPacket`; record failures without retrying stale snapshots or blocking serial ingestion.

- [ ] **Step 5: Run firmware tests and compile**

Run:

```bash
clang++ -std=c++17 -Itransmission/ESP/tcp_oled -I/Users/exterkamp/Documents/Arduino/libraries/ArduinoJson/src tests/firmware/test_udp_subscription.cpp transmission/ESP/tcp_oled/connection_protocol.cpp -o /tmp/dakdash_udp_subscription_test
/tmp/dakdash_udp_subscription_test
python3 -m unittest tests.test_firmware_protocol tests.test_udp_shadow -v
arduino-cli compile --fqbn esp32:esp32:esp32 transmission/ESP/tcp_oled
```

Expected: all tests PASS and firmware compiles under resource limits.

- [ ] **Step 6: Commit UDP firmware**

```bash
git add transmission/ESP/tcp_oled/udp_shadow_sender.h transmission/ESP/tcp_oled/udp_shadow_sender.cpp transmission/ESP/tcp_oled/connection_protocol.h transmission/ESP/tcp_oled/connection_protocol.cpp transmission/ESP/tcp_oled/connection_server.cpp transmission/ESP/tcp_oled/tcp_oled.ino tests/firmware/test_udp_subscription.cpp
git commit -m "Add negotiated UDP shadow transport"
```

### Task 5: Supervisor Fallback, Soak Report, and UI Handoff

**Files:**
- Modify: `services/connection/supervisor.py`
- Modify: `services/runtime.py`
- Modify: `routes/api.py`
- Create: `scripts/transport_soak.py`
- Create: `scripts/report_transport_metrics.py`
- Create: `tests/test_connection_fallback.py`
- Create: `tests/test_transport_report.py`
- Create: `docs/operations/udp-shadow-test.md`
- Create: `docs/handoffs/connection-ui-prompt.md`

**Interfaces:**
- Consumes: discovery, TCP transport, UDP receiver, metrics, and existing stable API.
- Produces: direct-first fallback behavior, JSONL evidence, summary report, and a UI-agent prompt.

- [ ] **Step 1: Write direct-first fallback tests**

Test these ordered outcomes with injected factories:

1. Saved endpoint succeeds: discovery call count is zero.
2. Saved endpoint fails and discovery returns a matching device: connect once to discovered endpoint.
3. Saved endpoint and three discovery probes fail: status becomes `DISCONNECTED` with reason `manual_ip_required`; no fourth probe occurs.
4. UDP receiver fails after subscription: valid TCP snapshots continue publishing with no revision rollback.

- [ ] **Step 2: Run and verify failures**

Run: `python3 -m unittest tests.test_connection_fallback -v`

Expected: FAIL because fallback integration is absent.

- [ ] **Step 3: Integrate direct-first discovery and shadow recording**

The supervisor attempts the saved endpoint once per reconnect cycle. Only `ConnectionRefusedError`, connect timeout, unreachable-network errors, or identity mismatch invoke one bounded discovery call. After a successful TCP handshake, start `UdpShadowReceiver`, send subscription, and record both transports. Publish TCP envelopes only while shadow mode is active. Stop/replace must close TCP, UDP, and discovery sockets before joining threads.

- [ ] **Step 4: Implement deterministic report scripts**

`transport_soak.py` accepts `--duration-seconds`, `--output`, and DakDash diagnostics URL, refuses durations outside 60–28800 seconds, records JSONL atomically, and exits nonzero if diagnostics stop responding for more than 5 seconds. `report_transport_metrics.py INPUT.jsonl --output REPORT.json` emits counts, gaps, duplicates, reordering, p50/p95/p99 arrival delta, per-transport longest blackout, and acceptance-goal results.

- [ ] **Step 5: Write and test the UDP decision rule**

The report recommendation is:

- retain TCP when TCP meets the 250 ms p95 and 500 ms p99 goals and UDP's p95 matched-arrival lead is below 20 ms with less than 100 ms blackout improvement;
- otherwise recommend UDP-primary evaluation only when UDP arrives before TCP for at least 95% of matched states and has a p95 lead of at least 20 ms, or reduces worst blackout by at least 100 ms, while producing no additional stale-source events and passing automatic TCP fallback;
- report `insufficient_evidence` with fewer than 10,000 matched states or less than two hours of samples.

Write unit tests with fixed JSONL fixtures for all three decisions.

- [ ] **Step 6: Write the operations guide**

The guide requires both Mac and ESP32 on Ethernet, records IP/MAC/DHCP reservation, runs simultaneous timestamped ping to ESP32 and default gateway, injects frames at 100 ms, performs a two-hour soak, interrupts TCP/Ethernet/power, and generates the comparison report. Acceptance remains p95 under 250 ms, p99 under 500 ms, no stale replay/default overwrite, and automatic recovery.

- [ ] **Step 7: Write the self-contained UI-agent prompt**

`docs/handoffs/connection-ui-prompt.md` must instruct the UI agent to consume existing backend endpoints without changing connection code. It must list `LIVE`, `STALE_SOURCE`, `WAITING_FOR_CLIENT`, `DISCONNECTED`, and `INCOMPATIBLE`; show saved-IP attempt, bounded discovery progress, manual fallback, source age, revision, TCP/UDP mode, and diagnostic counters; preserve current sport controls and OBS rendering; avoid browser polling overlap; and include screenshots plus standalone-browser/OBS verification. It must explicitly state that the connection agent owns `services/connection/`, `services/runtime.py`, and firmware files.

- [ ] **Step 8: Run complete verification**

Run:

```bash
python3 -m unittest discover -s tests -v
python3 -m compileall main.py routes services scripts tests
arduino-cli compile --fqbn esp32:esp32:esp32 transmission/ESP/tcp_oled
```

Expected: all tests PASS, Python compilation exits 0, and firmware compiles within resource limits.

- [ ] **Step 9: Commit integration and handoff**

```bash
git add services/connection/supervisor.py services/runtime.py routes/api.py scripts/transport_soak.py scripts/report_transport_metrics.py tests/test_connection_fallback.py tests/test_transport_report.py docs/operations/udp-shadow-test.md docs/handoffs/connection-ui-prompt.md
git commit -m "Integrate discovery and UDP shadow evaluation"
```

## Plan Completion Gate

Do not select UDP primary from synthetic or Wi-Fi-path data. Complete the two-hour all-wired venue run with at least 10,000 matched states, verify automatic TCP fallback, and preserve the generated JSON report. The report's deterministic rule produces the recommendation; a later approved change may switch publication preference while retaining TCP control/fallback.
