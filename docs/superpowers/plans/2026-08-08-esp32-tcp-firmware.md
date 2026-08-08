# ESP32 TCP Firmware and Bench Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Archive a recoverable sanitized firmware build, then replace blocking raw-byte relay behavior with nonblocking serial framing and the versioned TCP protocol.

**Architecture:** Pure C++ framing and protocol units are host-tested with `clang++`; Arduino adapters own UART, Ethernet, TCP, and OLED I/O. Serial ingestion always runs, stores only the newest frame, and never waits for display or network operations.

**Tech Stack:** Arduino CLI 1.5.1, `esp32:esp32:esp32`, ESP32 core 3.3.7, ArduinoJson 7.4.3, Adafruit GFX 1.12.5, Adafruit SSD1306 2.5.16, Adafruit BusIO 1.17.4, C++17 host tests, Python 3.9 bench utilities.

## Global Constraints

- Complete the host-foundation plan before this plan.
- Preserve TCP port `1234`, UART baud `19200`, protocol version `1`, 4,096-byte record limit, 512-byte decoded payload limit, and 1-second heartbeat.
- Preserve the currently working LAN8720 pin/clock configuration until the physical carrier-board marking is verified.
- Never drive GPIO0, EN, RX0, or TX0 with 5 V logic.
- Ground GPIO0 only during reset to enter download mode; release it before normal Ethernet operation.
- Disconnect the live Daktronics/scoreboard UART source while FTDI is attached for flashing or injection.
- Do not commit Wi-Fi credentials or a raw flash image containing credentials.
- No JavaScript, template, CSS, or SVG changes.

---

## File Map

- Create `transmission/ESP/archive/tcp_oled_legacy_2026_08_08/`: sanitized source, build manifest, recovery binary, hashes, and instructions.
- Create `transmission/ESP/tcp_oled/serial_pipeline.h/.cpp`: SOH/EOT framing and latest-frame storage.
- Create `transmission/ESP/tcp_oled/connection_protocol.h/.cpp`: protocol-v1 JSON encoding/decoding, Base64, and CRC32.
- Create `transmission/ESP/tcp_oled/network_manager.h/.cpp`: Ethernet DHCP/link state without blocking waits.
- Create `transmission/ESP/tcp_oled/connection_server.h/.cpp`: one-client TCP handshake, heartbeat, and snapshot writes.
- Create `transmission/ESP/tcp_oled/display_controller.h/.cpp`: rate-limited OLED rendering.
- Modify `transmission/ESP/tcp_oled/tcp_oled.ino`: thin setup/loop composition.
- Create `tests/firmware/`: host C++ tests and protocol-vector driver.
- Create `scripts/find_esp_port.py` and `scripts/inject_rtd.py`: safe bench utilities.
- Create `requirements-dev.txt`: pin PySerial for serial injection.

### Task 1: Sanitized Recovery Archive and Toolchain Lock

**Files:**
- Create: `transmission/ESP/archive/tcp_oled_legacy_2026_08_08/BUILD.md`
- Create: `transmission/ESP/archive/tcp_oled_legacy_2026_08_08/tcp_oled_legacy_2026_08_08.ino`
- Generate: `transmission/ESP/archive/tcp_oled_legacy_2026_08_08/tcp_oled_legacy_2026_08_08.bin`
- Generate: `transmission/ESP/archive/tcp_oled_legacy_2026_08_08/SHA256SUMS`
- Modify: `transmission/ESP/tcp/tcp.ino`

**Interfaces:**
- Produces: reproducible recovery source and binary; no runtime interface.
- Consumes: current sanitized `tcp_oled.ino` working-tree content.

- [ ] **Step 1: Verify and remove plaintext firmware credentials**

Run:

```bash
rg -n 'const char\s*\*?(ssid|password)\s*=\s*".+"' transmission/ESP
```

Expected before sanitizing: any remaining credential-bearing legacy lines are listed, including `transmission/ESP/tcp/tcp.ino`. Replace their values with empty strings using `apply_patch`, then rerun the command. Expected after sanitizing: no output and exit status 1.

- [ ] **Step 2: Create the archive source and exact build manifest**

Copy the sanitized current sketch into `tcp_oled_legacy.ino`. `BUILD.md` must contain these exact commands and safety notes:

```bash
arduino-cli core install esp32:esp32@3.3.7
arduino-cli lib install "Adafruit BusIO@1.17.4"
arduino-cli lib install "Adafruit GFX Library@1.12.5"
arduino-cli lib install "Adafruit SSD1306@2.5.16"
arduino-cli compile --fqbn esp32:esp32:esp32 transmission/ESP/archive/tcp_oled_legacy_2026_08_08
```

Document FTDI common ground, 3.3 V UART logic, crossed RX/TX, IO0-low-during-reset entry, IO0 release, and EN/power-cycle restart.

- [ ] **Step 3: Compile and archive the recovery application image**

Run:

```bash
mkdir -p /tmp/dakdash-legacy-build
arduino-cli compile --fqbn esp32:esp32:esp32 --output-dir /tmp/dakdash-legacy-build transmission/ESP/archive/tcp_oled_legacy_2026_08_08
cp /tmp/dakdash-legacy-build/tcp_oled_legacy_2026_08_08.ino.bin transmission/ESP/archive/tcp_oled_legacy_2026_08_08/tcp_oled_legacy_2026_08_08.bin
shasum -a 256 transmission/ESP/archive/tcp_oled_legacy_2026_08_08/tcp_oled_legacy_2026_08_08.ino transmission/ESP/archive/tcp_oled_legacy_2026_08_08/tcp_oled_legacy_2026_08_08.bin > transmission/ESP/archive/tcp_oled_legacy_2026_08_08/SHA256SUMS
```

Expected: compile exit 0 and two hash lines.

- [ ] **Step 4: Verify the archive from source**

Run:

```bash
shasum -a 256 -c transmission/ESP/archive/tcp_oled_legacy_2026_08_08/SHA256SUMS
```

Expected: both entries report `OK`.

- [ ] **Step 5: Commit the recovery point**

```bash
git add transmission/ESP/tcp/tcp.ino transmission/ESP/archive/tcp_oled_legacy_2026_08_08
git commit -m "Archive sanitized scoreboard firmware"
```

### Task 2: Host-Tested Serial Framing and Latest-Frame Storage

**Files:**
- Create: `transmission/ESP/tcp_oled/serial_pipeline.h`
- Create: `transmission/ESP/tcp_oled/serial_pipeline.cpp`
- Create: `tests/firmware/test_serial_pipeline.cpp`

**Interfaces:**
- Produces: `dakdash::SerialFramer::push(uint8_t, CompletedFrame&) -> bool` and `dakdash::LatestFrameStore::publish(const CompletedFrame&, uint32_t)`.
- Consumes: individual UART bytes and `millis()` values supplied by the `.ino` adapter.

- [ ] **Step 1: Write pure C++ framing tests**

```cpp
// tests/firmware/test_serial_pipeline.cpp
#include <cassert>
#include <cstdint>
#include "serial_pipeline.h"

using dakdash::CompletedFrame;
using dakdash::LatestFrameStore;
using dakdash::SerialFramer;

int main() {
  SerialFramer framer;
  CompletedFrame frame{};
  const uint8_t stream[] = {0x55, 0x01, 'A', 'B', 0x04,
                            0x01, 'C', 'D', 0x04};
  int completed = 0;
  for (uint8_t byte : stream) {
    if (framer.push(byte, frame)) {
      ++completed;
      assert(frame.length == 2);
      assert(frame.bytes[0] == (completed == 1 ? 'A' : 'C'));
    }
  }
  assert(completed == 2);

  SerialFramer oversized;
  for (int i = 0; i < 514; ++i) oversized.push(i == 0 ? 0x01 : 'X', frame);
  assert(!oversized.push(0x04, frame));
  assert(oversized.rejected_frames() == 1);

  LatestFrameStore store;
  frame.length = 1;
  frame.bytes[0] = 'Z';
  store.publish(frame, 1234);
  assert(store.state_seq() == 1);
  assert(store.received_ms() == 1234);
  assert(store.frame().bytes[0] == 'Z');
}
```

- [ ] **Step 2: Run and verify compile failure**

Run:

```bash
clang++ -std=c++17 -Itransmission/ESP/tcp_oled tests/firmware/test_serial_pipeline.cpp transmission/ESP/tcp_oled/serial_pipeline.cpp -o /tmp/dakdash_serial_pipeline_test
```

Expected: FAIL because `serial_pipeline.h/.cpp` do not exist.

- [ ] **Step 3: Implement bounded framing and latest-only storage**

Use these public types:

```cpp
namespace dakdash {
constexpr std::size_t kMaxPayloadBytes = 512;
struct CompletedFrame {
  std::array<uint8_t, kMaxPayloadBytes> bytes{};
  std::size_t length{0};
};
class SerialFramer {
 public:
  bool push(uint8_t byte, CompletedFrame& completed);
  uint32_t rejected_frames() const;
 private:
  CompletedFrame building_{};
  bool in_frame_{false};
  bool overflowed_{false};
  uint32_t rejected_frames_{0};
};
class LatestFrameStore {
 public:
  void publish(const CompletedFrame& frame, uint32_t received_ms);
  const CompletedFrame& frame() const;
  uint32_t state_seq() const;
  uint32_t received_ms() const;
 private:
  CompletedFrame frame_{};
  uint32_t state_seq_{0};
  uint32_t received_ms_{0};
};
}
```

SOH starts or restarts a frame; EOT publishes payload bytes excluding delimiters; noise outside frames is discarded. An oversized frame is rejected at EOT, increments the counter once, and cannot overwrite the last complete frame.

- [ ] **Step 4: Compile and run the host test**

Run:

```bash
clang++ -std=c++17 -Itransmission/ESP/tcp_oled tests/firmware/test_serial_pipeline.cpp transmission/ESP/tcp_oled/serial_pipeline.cpp -o /tmp/dakdash_serial_pipeline_test
/tmp/dakdash_serial_pipeline_test
```

Expected: both commands exit 0 with no assertion output.

- [ ] **Step 5: Commit the serial pipeline**

```bash
git add transmission/ESP/tcp_oled/serial_pipeline.h transmission/ESP/tcp_oled/serial_pipeline.cpp tests/firmware/test_serial_pipeline.cpp
git commit -m "Add bounded ESP32 serial framing"
```

### Task 3: Firmware Protocol Codec Compatible with Python

**Files:**
- Create: `transmission/ESP/tcp_oled/connection_protocol.h`
- Create: `transmission/ESP/tcp_oled/connection_protocol.cpp`
- Create: `tests/firmware/protocol_vector.cpp`
- Create: `tests/test_firmware_protocol.py`

**Interfaces:**
- Consumes: Task 2 `CompletedFrame`; protocol-v1 constants from the approved spec.
- Produces: `encode_snapshot_json`, `encode_heartbeat_json`, `decode_client_hello`, `crc32`, and `base64_encode` using caller-provided fixed buffers.

- [ ] **Step 1: Install and pin the codec dependency**

Run: `arduino-cli lib install "ArduinoJson@7.4.3"`

Expected: ArduinoJson 7.4.3 installed under `/Users/exterkamp/Documents/Arduino/libraries/ArduinoJson`.

- [ ] **Step 2: Write a cross-language protocol-vector test**

```python
# tests/test_firmware_protocol.py
import subprocess
import unittest
from services.connection.protocol import decode_envelope


class FirmwareProtocolTests(unittest.TestCase):
    def test_cpp_snapshot_decodes_with_python_codec(self):
        subprocess.run([
            "clang++", "-std=c++17",
            "-Itransmission/ESP/tcp_oled",
            "-I/Users/exterkamp/Documents/Arduino/libraries/ArduinoJson/src",
            "tests/firmware/protocol_vector.cpp",
            "transmission/ESP/tcp_oled/connection_protocol.cpp",
            "-o", "/tmp/dakdash_protocol_vector",
        ], check=True)
        body = subprocess.check_output(["/tmp/dakdash_protocol_vector"])
        envelope = decode_envelope(body)
        self.assertEqual(envelope.device_id, "wt32-aabbccddeeff")
        self.assertEqual(envelope.session_id, "boot-1234")
        self.assertEqual(envelope.state_seq, 7)
        self.assertEqual(envelope.payload, b"12:00HOME")
```

The C++ vector program constructs a `CompletedFrame` containing `12:00HOME`, encodes one snapshot with the asserted identity/session/sequence, writes only its JSON body to stdout, and returns nonzero when encoding fails.

- [ ] **Step 3: Run and verify compile failure**

Run: `python3 -m unittest tests.test_firmware_protocol -v`

Expected: FAIL because the firmware codec files do not exist.

- [ ] **Step 4: Implement fixed-buffer JSON, Base64, and CRC32**

Expose:

```cpp
struct ProtocolFields {
  const char* device_id;
  const char* session_id;
  uint32_t packet_seq;
  uint32_t state_seq;
  uint32_t uptime_ms;
  uint32_t serial_age_ms;
};
struct HealthMetrics {
  uint32_t uart_bytes;
  uint32_t rejected_frames;
  uint32_t overwritten_frames;
  uint32_t tcp_connects;
  uint32_t tcp_write_failures;
};
std::size_t encode_snapshot_json(const ProtocolFields&, const CompletedFrame&,
                                 char* output, std::size_t capacity);
std::size_t encode_heartbeat_json(const ProtocolFields&, const HealthMetrics&,
                                  char* output, std::size_t capacity);
bool decode_client_hello(const char* json, std::size_t length,
                         char* expected_device_id, std::size_t capacity);
```

Use ArduinoJson fixed-capacity documents, compact serialization, a standard RFC 4648 Base64 encoder, and the same CRC32 polynomial/result as Python `zlib.crc32`. Return `0` rather than truncating when output capacity is insufficient.

- [ ] **Step 5: Run Python-to-C++ compatibility tests**

Run: `python3 -m unittest tests.test_protocol tests.test_firmware_protocol -v`

Expected: all protocol tests PASS.

- [ ] **Step 6: Commit the firmware codec**

```bash
git add transmission/ESP/tcp_oled/connection_protocol.h transmission/ESP/tcp_oled/connection_protocol.cpp tests/firmware/protocol_vector.cpp tests/test_firmware_protocol.py
git commit -m "Add ESP32 connection protocol codec"
```

### Task 4: Nonblocking Ethernet, TCP, and OLED Adapters

**Files:**
- Create: `transmission/ESP/tcp_oled/network_manager.h`
- Create: `transmission/ESP/tcp_oled/network_manager.cpp`
- Create: `transmission/ESP/tcp_oled/connection_server.h`
- Create: `transmission/ESP/tcp_oled/connection_server.cpp`
- Create: `transmission/ESP/tcp_oled/display_controller.h`
- Create: `transmission/ESP/tcp_oled/display_controller.cpp`
- Modify: `transmission/ESP/tcp_oled/tcp_oled.ino`

**Interfaces:**
- Consumes: Tasks 2–3 frame store and codec.
- Produces: `NetworkManager::tick(now_ms)`, `ConnectionServer::tick(now_ms, latest_frame)`, and `DisplayController::tick(now_ms, status)`.

- [ ] **Step 1: Replace callback work with state flags**

`WiFiEvent` may update only `std::atomic` link/IP event flags. Move `String` mutation, server start, OLED drawing, reconnect actions, and status formatting into `loop()`-driven `tick()` methods. Remove all setup link-wait loops and all `delay()` calls.

- [ ] **Step 2: Implement Ethernet runtime recovery**

`NetworkManager` states are `STARTING`, `WAITING_DHCP`, `READY`, and `LINK_DOWN`. It calls the existing working `ETH.begin(...)` exactly once per recovery attempt, exposes `ETH.localIP()` and `ETH.macAddress()`, and restarts the TCP server after a changed DHCP address. Wi-Fi remains disabled.

- [ ] **Step 3: Implement one-client TCP handshake and records**

`ConnectionServer` must:

- call `client.setNoDelay(true)` after accept;
- require a length-prefixed `CLIENT_HELLO` no larger than 4,096 bytes within 2 seconds;
- reject unsupported versions or mismatched expected device IDs;
- send `HELLO`, then each new state once and a heartbeat every 1,000 ms;
- write the 4-byte big-endian length and JSON body only when `availableForWrite()` permits a bounded chunk;
- check returned byte counts, abandon failed clients, and never block UART ingestion;
- keep only one protocol-validated client session, with no remote control commands.

- [ ] **Step 4: Implement rate-limited OLED status**

Render at most every 250 ms and only when visible state changes. Display `DakDash`, IP, abbreviated MAC/device ID, TCP state, serial state, and an activity pixel based on `last_frame_ms`; never flash with a sleep/delay.

- [ ] **Step 5: Reduce the `.ino` to orchestration**

`setup()` initializes Wire, UART at 19,200, OLED, event registration, and component instances. `loop()` drains all available UART bytes through `SerialFramer`, publishes complete frames, then calls network, connection, and display ticks in that order. Do not emit application diagnostic text on UART0 at any point; use the OLED and network counters instead.

- [ ] **Step 6: Compile the complete firmware**

Run: `arduino-cli compile --fqbn esp32:esp32:esp32 transmission/ESP/tcp_oled`

Expected: exit 0, flash use below 90%, static RAM use below 25%.

- [ ] **Step 7: Run all host-side firmware tests**

Run:

```bash
/tmp/dakdash_serial_pipeline_test
python3 -m unittest tests.test_firmware_protocol -v
```

Expected: both commands exit 0.

- [ ] **Step 8: Commit adapter integration**

```bash
git add transmission/ESP/tcp_oled
git commit -m "Harden ESP32 TCP scoreboard transport"
```

### Task 5: Safe Upload and Wired Bench Test

**Files:**
- Create: `requirements-dev.txt`
- Create: `scripts/find_esp_port.py`
- Create: `scripts/inject_rtd.py`
- Create: `tests/test_bench_scripts.py`
- Create: `docs/operations/esp32-bench-test.md`

**Interfaces:**
- Consumes: completed firmware and host connection foundation.
- Produces: deterministic port detection, serial fixture injection, and recorded bench evidence.

- [ ] **Step 1: Write serial-port selection and fixture tests**

`find_esp_port.py` parses `arduino-cli board list --format json`, accepts exactly one serial address matching `/dev/cu.usbserial*`, `/dev/cu.wchusbserial*`, or `/dev/cu.SLAB_USBtoUART*`, prints it, and fails clearly for zero or multiple matches. `inject_rtd.py` exposes `framed(payload: bytes) -> bytes` returning `b"\x01" + payload + b"\x04"` and provides football, basketball, and baseball fixtures. Test both functions without opening hardware.

- [ ] **Step 2: Run and verify missing-script failures**

Run: `python3 -m unittest tests.test_bench_scripts -v`

Expected: FAIL importing `scripts.find_esp_port` and `scripts.inject_rtd`.

- [ ] **Step 3: Implement utilities and pin PySerial**

Add exactly `pyserial==3.5` to `requirements-dev.txt`. The injector accepts `--port`, `--fixture`, `--count`, and `--interval-ms`, opens at 19,200 baud, and writes one complete framed fixture per interval. It rejects counts outside 1–10000 and intervals outside 10–5000 ms.

- [ ] **Step 4: Run utility and full automated tests**

Run:

```bash
python3 -m unittest discover -s tests -v
arduino-cli compile --fqbn esp32:esp32:esp32 transmission/ESP/tcp_oled
```

Expected: all tests PASS and firmware compile exits 0.

- [ ] **Step 5: Stop for physical flashing confirmation**

Do not upload until the user confirms: scoreboard UART disconnected, common ground present, FTDI TX logic measured/verified at 3.3 V, board powered from one source, and GPIO0/EN leads identified.

- [ ] **Step 6: Enter download mode and upload**

With GPIO0 held to GND, pulse EN low then release (or power-cycle), then run:

```bash
ESP_PORT="$(python3 scripts/find_esp_port.py)"
arduino-cli upload -p "$ESP_PORT" --fqbn esp32:esp32:esp32 transmission/ESP/tcp_oled
```

Expected: upload verifies successfully. Remove GPIO0 from GND and pulse EN/power-cycle for normal boot.

- [ ] **Step 7: Inject frames and exercise failure recovery**

Run the Flask app against the device DHCP-reserved address, then:

```bash
ESP_PORT="$(python3 scripts/find_esp_port.py)"
python3 scripts/inject_rtd.py --port "$ESP_PORT" --fixture football --count 100 --interval-ms 100
```

Verify 100 increasing state sequences, no malformed frames, no UART overflow, and last-good state retention. Repeat while disconnecting/reconnecting TCP and Ethernet. Run a two-hour injection soak at 100 ms and record memory, reconnects, rejected frames, and p95/p99 backend processing latency.

- [ ] **Step 8: Commit bench tooling and evidence instructions**

```bash
git add requirements-dev.txt scripts/find_esp_port.py scripts/inject_rtd.py tests/test_bench_scripts.py docs/operations/esp32-bench-test.md
git commit -m "Add ESP32 connection bench workflow"
```

## Plan Completion Gate

Completion requires the recovery hashes to verify, all Python/C++ tests to pass, firmware to compile within resource limits, one confirmed safe upload, failure-recovery checks, and a two-hour wired bench soak. Do not begin UDP-primary selection; the next plan first implements bounded discovery and UDP shadow measurement.
