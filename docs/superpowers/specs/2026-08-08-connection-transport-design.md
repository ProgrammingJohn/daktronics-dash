# DakDash Connection Transport Design

## Purpose

DakDash will replace its raw TCP byte relay with a versioned, observable one-to-one connection between one ESP32 scoreboard device and one DakDash Mac. The primary deployment is both endpoints connected by Ethernet to a managed school LAN using DHCP. The ESP32 currently has a DHCP reservation. The design targets less than 250 ms p95 processing latency and accepts less than 500 ms p99 latency from a complete serial frame reaching the ESP32 to backend state publication.

Browser and OBS UI changes are excluded. The connection API will expose stable data for a separate UI implementation.

## Decisions and Non-Goals

- Hardened TCP is the authoritative first transport.
- UDP shadow testing is mandatory before choosing UDP as primary.
- Firmware and Python application may be upgraded as a matched release.
- The current firmware will be archived as a sanitized recovery build before behavior changes.
- One ESP32 serves one active DakDash client. Multi-receiver delivery is not in scope.
- Sport parsing remains on the Mac initially; the ESP32 transports complete raw Daktronics frames.
- Ethernet and DHCP are required. Static IP configuration, direct-link networking, and automatic Wi-Fi fallback are not initial requirements.
- Discovery is bounded and runs only after a direct connection fails. There is no continuous broadcast or network scan.
- Protocol version 1 is read-only and does not provide remote configuration or scoreboard control. Device ID and nonces prevent accidental mismatches but are not authentication; cryptographic pairing is deferred unless the school threat model requires it.

## Current Baseline

The device uses an ESP32 WT32-S1-class module, UART0 at 19,200 baud, a LAN8720 Ethernet interface, an SSD1306 OLED, and TCP port `1234`. The current sketch compiles with Arduino CLI 1.5.1, FQBN `esp32:esp32:esp32`, ESP32 core 3.3.7, Adafruit GFX 1.12.5, Adafruit SSD1306 2.5.16, and Adafruit BusIO 1.17.4.

Before changing PHY pins or clock mode, implementation must verify the carrier-board marking. The currently working Ethernet configuration remains unchanged until that verification. GPIO0 is grounded only during reset to enter the UART bootloader and must be released for normal operation. FTDI UART signals must use 3.3 V logic even when the board is powered through its regulated 5 V input.

## Recovery Archive

The recovery archive will contain sanitized legacy source, a build manifest, compile and upload commands, a compiled image, SHA-256 hashes, and IO0/EN recovery steps. Credentials and a raw flash dump containing credentials must not be committed. The archive must compile before any new firmware is flashed.

## Connection Startup and Discovery

1. DakDash attempts TCP port `1234` at the saved DHCP-reserved address and sends `CLIENT_HELLO` with its supported protocol version and expected device ID.
2. The ESP32 validates the request and returns `HELLO` with its identity and session details. DakDash checks the expected stable `device_id`; an IP address alone is not identity.
3. If direct connection fails, DakDash sends three UDP discovery requests over approximately three seconds. Each contains a random request nonce and optional expected device ID.
4. The matching ESP32 replies by unicast. Responses are rate-limited and echo the nonce.
5. DakDash connects to the returned address. If discovery fails, the backend reports that manual address entry is required and stops probing.

Discovery may be blocked by school VLAN or broadcast policy, so the reserved address and manual entry remain dependable fallbacks.

## Versioned Wire Protocol

TCP records use a four-byte network-order length prefix followed by a UTF-8 JSON envelope, with a maximum encoded record size of 4,096 bytes. UDP carries one complete JSON envelope per datagram. Snapshot payload bytes are Base64 encoded, limited to 512 decoded bytes so every UDP datagram stays below 1,200 bytes, and protected by a payload CRC32.

Every envelope includes:

- `protocol_version`
- `message_type`
- stable `device_id`
- random-per-boot `session_id`
- monotonically increasing `packet_seq`
- `state_seq`, incremented only for a new valid serial frame
- ESP32 `uptime_ms`
- `serial_age_ms`

Message types are `CLIENT_HELLO`, `HELLO`, `SNAPSHOT`, `HEARTBEAT`, `STATUS`, `DISCOVER`, `DISCOVER_RESPONSE`, and `SUBSCRIBE_UDP`. Heartbeats are emitted once per second even when no Daktronics data is present. They include firmware version, interface/IP information, link status, serial/frame ages, frame/error/drop counters, client state, and uptime.

## ESP32 Responsibilities

- `SerialFramer` continuously drains UART and extracts bounded SOH/EOT frames regardless of client state.
- `LatestFrameStore` retains only the newest complete frame plus timestamps and sequence number. Under pressure, stale pending data is overwritten rather than queued.
- `ConnectionServer` accepts one TCP client, performs the handshake, sends framed records in chunks, checks write results, enables `TCP_NODELAY`, and replaces an old client only after a valid new handshake.
- `UdpShadowSender` sends matching unicast snapshots only after negotiation over the active TCP session.
- `DiscoveryResponder` answers valid bounded discovery probes but never initiates broadcast traffic.
- `NetworkManager` manages Ethernet DHCP and runtime link/address recovery without blocking serial ingestion.
- `HealthMetrics` tracks UART bytes/overflow, valid/rejected frames, overwritten snapshots, network writes/failures, clients, and timestamps.
- `DisplayController` updates the OLED from the main loop at no more than four times per second. Network callbacks set flags only; they do not call I2C or delay execution.

Wi-Fi credentials are not stored in source. Wi-Fi fallback remains disabled unless a future design explicitly adds external configuration.

## Python Responsibilities

- A connection supervisor owns connect, cancellation, socket shutdown, and reconnect with bounded exponential backoff and jitter.
- TCP and UDP transports emit complete envelopes through the same interface.
- The TCP decoder handles partial records, multiple records per read, EOF, malformed lengths, and bounded buffering.
- The protocol validator rejects incompatible versions, invalid CRCs, stale sessions, duplicates, and out-of-order records.
- Existing sport decoders receive one validated raw frame and return a typed canonical schema.
- A thread-safe latest-state store publishes immutable snapshots with revision, receive time, valid-frame time, source identity, connection generation, and counters.
- The API exposes the canonical score, revision, source age, transport health, source health, and diagnostics without coupling those fields to presentation.

Timeouts and malformed messages never replace the last valid score with defaults. A stopped or superseded connection generation cannot publish state.

## Health Model and Recovery

Transport and source health are distinct:

- `LIVE`: transport is healthy and a valid frame is newer than `max(3 × measured source interval, 2 seconds)`.
- `STALE_SOURCE`: heartbeat is current but the valid serial frame is too old.
- `WAITING_FOR_CLIENT`: Ethernet/DHCP is healthy with no application client.
- `DISCONNECTED`: link/connect failure, TCP EOF, or three missed heartbeats.
- `INCOMPATIBLE`: device identity or protocol version validation failed.

The ESP32 creates a new session ID after reboot. Python resets sequence expectations only for a validated new session. Reconnect and DHCP changes recover without restarting Flask or the ESP32.

## UDP Shadow Evaluation

After TCP negotiation, DakDash supplies a UDP receive port and nonce. The ESP32 sends each snapshot over both TCP and unicast UDP with the same `session_id` and `state_seq`. TCP remains authoritative during the experiment.

DakDash records arrival time, gaps, duplication, reordering, source age, p50/p95/p99 freshness, and worst blackout duration for both copies. Since matching records originate from the same ESP32 event, their Mac arrival times can be compared without synchronizing clocks.

UDP becomes eligible as primary only when tests on the all-wired school network show materially better tail latency or blackout behavior without more stale periods or operational failures. TCP stays connected as the control path and automatic data fallback. If UDP health expires, DakDash immediately publishes the matching TCP stream.

## Verification and Rollout

Automated tests cover arbitrary TCP segmentation/coalescing, EOF, timeouts, invalid lengths/versions/CRC, oversize payloads, sequence/session behavior, health transitions, cancellation, reconnect races, canonical sport schemas, and a fake ESP32 loopback server.

Bench tests inject recorded SOH/EOT frames through FTDI at 19,200 baud while Ethernet returns them to DakDash. Tests deliberately interrupt serial input, TCP, Ethernet, DHCP, and power. Instrumentation measures serial receipt, frame completion, ESP send, Mac receive, parse, and state publication. A multi-hour soak test verifies bounded memory, stable counters, and automatic recovery.

Venue validation repeats the test with both Mac and ESP32 wired. Acceptance requires:

- p95 processing latency below 250 ms and p99 below 500 ms;
- no stale replay or replacement of last-good data with defaults;
- automatic recovery from interruption without restarting either endpoint;
- stable resource use during the soak test;
- a verified recovery compile/upload procedure; and
- a TCP-versus-UDP report containing tail latency, sequence gaps, and blackout duration.

When UI work becomes necessary, DakDash will provide a self-contained prompt describing the API contract, health states, discovery behavior, diagnostics, and required presentation. This connection project will not modify the UI.
