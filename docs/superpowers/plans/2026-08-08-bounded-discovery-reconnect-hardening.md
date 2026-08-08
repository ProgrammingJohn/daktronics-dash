# Bounded Discovery and Reconnect Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the verified TCP scoreboard path while removing same-session reconnect churn and adding identity-validated, bounded device discovery with API diagnostics.

**Architecture:** Saved-address TCP remains first and authoritative. After its first failure—or immediately when no address is supplied—the host checks the passive ARP cache, then sends at most three UDP discovery probes within 500 ms; the ESP replies only to valid requests by unicast and rate-limits responses. Discovery runs once per supervisor startup, never continuously.

**Tech Stack:** Python 3.9 standard library sockets/subprocess, Flask, `unittest`, ESP32 Arduino core 3.3.7, ArduinoJson 7.4.3, `WiFiUDP`, Arduino CLI, and native C++17 tests.

## Global Constraints

- Keep TCP port `1234` authoritative and compatible with the flashed protocol-v1 firmware.
- Do not scan the `/20` school subnet or run recurring broadcast loops.
- Match the stable `device_id`; an IP address alone is never accepted as identity.
- Preserve one ESP32-to-one-Mac operation, DHCP, UART draining order, and latest-state semantics.
- Do not modify frontend files; provide a handoff describing the additive API fields.
- Keep UDP datagrams at or below 1,200 bytes and discovery to three probes/500 ms maximum.

---

### Task 1: Same-session reconnect hardening

**Files:**
- Create: `transmission/ESP/tcp_oled/delivery_cursor.h`
- Create: `tests/firmware/test_delivery_cursor.cpp`
- Modify: `transmission/ESP/tcp_oled/connection_server.cpp`
- Modify: `services/connection/supervisor.py`
- Modify: `tests/test_supervisor.py`

**Interfaces:**
- Consumes: firmware `state_seq` and host per-session high-water marks.
- Produces: reconnects that do not resend or reject the already-published state.

- [ ] Add failing host tests proving equal same-session snapshot sequences are ignored without a protocol error while lower sequences remain errors.
- [ ] Add a failing native firmware test proving a delivery cursor retains its high-water mark across client teardown, reports true serial gaps, and resets only for a new boot session.
- [ ] Use the delivery cursor in firmware so client reconnects do not resend the current snapshot or inflate overwritten metrics.
- [ ] Change the supervisor to ignore equal `state_seq` snapshots and reject only rollback.
- [ ] Run `python3 -m unittest tests.test_supervisor -v`, compile/run `tests/firmware/test_delivery_cursor.cpp`, and commit.

### Task 2: Bounded host discovery

**Files:**
- Create: `services/connection/discovery.py`
- Create: `tests/test_discovery.py`
- Modify: `services/connection/protocol.py`

**Interfaces:**
- Produces: `DiscoveryResult(host, port, device_id, method)` and `DiscoveryClient.discover(expected_device_id, excluded_hosts=(), stop_event=None)`.
- Consumes: protocol-v1 `DISCOVER`/`DISCOVER_RESPONSE` envelopes with a fresh 16-hex nonce.

- [ ] Add failing tests for MAC derivation, passive ARP matching, three-probe/500 ms bounds, nonce/device filtering, immediate success, stop cancellation, and no subnet iteration.
- [ ] Expose a bounded JSON datagram encoder that retains the existing protocol validation and 4,096-byte JSON limit.
- [ ] Implement passive ARP resolution for `wt32-<12 hex>` identities and a three-window UDP broadcast client using `SO_BROADCAST`.
- [ ] Ignore malformed, wrong-version, wrong-device, wrong-nonce, invalid-IP, and invalid-port replies.
- [ ] Run `python3 -m unittest tests.test_discovery tests.test_protocol -v` and commit.

### Task 3: Supervisor and API discovery integration

**Files:**
- Modify: `services/connection/supervisor.py`
- Modify: `services/runtime.py`
- Modify: `routes/api.py`
- Modify: `tests/test_supervisor.py`
- Modify: `tests/test_api.py`

**Interfaces:**
- Produces additive status field `discovery` with `phase`, `active`, `attempts`, `method`, `requested_host`, and `resolved_host`.
- Accepts synced start requests with an optional `ip`, required valid `port`, and required `device_id`.

- [ ] Add failing supervisor tests for direct-first behavior, fallback after one direct failure, no repeated discovery, and exposed phase/result diagnostics.
- [ ] Add failing API/runtime tests proving an empty IP starts discovery and status retains its existing fields plus discovery diagnostics.
- [ ] Inject `DiscoveryClient`, resolve once per supervisor startup, and continue reconnecting to the validated resolved host without recurring broadcasts.
- [ ] Add thread-safe supervisor diagnostics and expose them through `ScoreboardRuntime.status()`.
- [ ] Run `python3 -m unittest tests.test_supervisor tests.test_runtime tests.test_api -v` and commit.

### Task 4: Rate-limited ESP32 discovery responder

**Files:**
- Create: `transmission/ESP/tcp_oled/discovery_responder.h`
- Create: `transmission/ESP/tcp_oled/discovery_responder.cpp`
- Create: `transmission/ESP/tcp_oled/discovery_rate_limiter.h`
- Create: `tests/firmware/test_discovery_protocol.cpp`
- Create: `tests/firmware/test_discovery_rate_limiter.cpp`
- Modify: `transmission/ESP/tcp_oled/connection_protocol.h`
- Modify: `transmission/ESP/tcp_oled/connection_protocol.cpp`
- Modify: `transmission/ESP/tcp_oled/tcp_oled.ino`
- Modify: `tests/test_firmware_protocol.py`

**Interfaces:**
- Consumes one UDP datagram per loop tick on port `1234`.
- Produces a unicast `DISCOVER_RESPONSE` containing matching device ID/nonce plus current IP and TCP port.

- [ ] Add failing native codec tests for request validation and response fields, plus rate-limiter tests for 250 ms minimum and three responses per rolling three seconds.
- [ ] Implement discovery codec functions using the existing static JSON arena and 1,200-byte datagram bound.
- [ ] Implement a nonblocking `DiscoveryResponder` that binds only while DHCP is ready, resets on link/address change, reads at most one datagram per tick, and never broadcasts.
- [ ] Tick discovery after serial draining and network state update without changing display or TCP behavior.
- [ ] Run native tests, cross-language protocol tests, stack-usage tests, and `arduino-cli compile --fqbn esp32:esp32:esp32 transmission/ESP/tcp_oled`.

### Task 5: End-to-end verification and UI handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-08-08-connection-transport-design.md`
- Modify: `docs/superpowers/plans/2026-08-08-udp-shadow-discovery.md`
- Create: `docs/handoffs/connection-discovery-ui-prompt.md`

**Interfaces:**
- Documents the additive API contract and manual frontend responsibilities without frontend changes.

- [ ] Update discovery timing and direct/ARP/broadcast order in the design and deferred UDP-shadow plan.
- [ ] Document UI presentation for `DIRECT_CONNECT`, `PASSIVE_LOOKUP`, `BROADCAST_PROBING`, `FOUND`, and `NOT_FOUND`.
- [ ] Run all  Python tests, native firmware tests, compileall, Arduino compile, credential scan, and `git diff --check`.
- [ ] Flash and verify the ESP32, then test saved-IP failure, passive ARP, broadcast discovery, TCP HELLO, real serial snapshots, and reconnect recovery on the live scoreboard.
- [ ] Request code review, address Critical/Important findings, and commit the verified checkpoint.
