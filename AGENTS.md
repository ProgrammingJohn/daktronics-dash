# Repository Guidelines

## Project Structure & Module Organization

`main.py` creates the Flask app. Keep HTTP handlers in `routes/` and networking, parsing, state, and preference logic in `services/`. Jinja pages live in `templates/`; browser code and styling live in `static/`. Scoreboard SVGs and defaults are in `scoreboard_svgs/`. The `transmission/` tree contains ESP32 firmware and legacy assets; change it only for device-side work.

## Current Architecture & Priorities

The verified synced path is Daktronics serial at 19,200 baud → ESP32 raw-byte relay → TCP port `1234` over Ethernet (Wi-Fi fallback) → SOH/EOT framing and sport parsing in `services/synced_service.py` → a `ScoreboardService` thread and in-memory state → Flask API → one-second polling in `static/js/viewer.js` → in-place SVG updates for OBS.

Work prioritizes connection reliability and latency, then UI/app improvements. Instrument before redesigning: measure serial receipt, network receipt, state update, browser receipt, and DOM update. Prefer the newest state over stale queued updates, keep ingestion independent of rendering, and expose `LIVE`, `STALE`, and `DISCONNECTED` diagnostics. UDP, WebSockets, discovery, and clock interpolation remain options until measurements justify them.

## Build, Test, and Development Commands

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Open `http://127.0.0.1:5000/`; `./run.command` starts the macOS flow. Run `python parse-football-test.py` for a parser smoke check and `python -m compileall main.py routes services` before submitting Python changes. For connection work, record `ping -c 100 <esp32-ip>` and `nc -vz <esp32-ip> 1234`; verify subnet, VLAN, firewall, and client isolation.

## Coding Style & Testing

Use four spaces in Python and two in JavaScript, HTML, and CSS. Use `snake_case` for functions, variables, and JSON fields; use `PascalCase` for classes. No formatter or automated test framework is configured. Exercise API success/error paths and manual/synced flows. Check affected sports in a browser and OBS. Add tests under `tests/` as `test_<feature>.py`, avoiding live-controller dependencies.

## Commits & Pull Requests

Use concise, imperative commit subjects and keep commits focused. Pull requests should explain behavior or protocol changes, list validation and latency evidence, link issues, and include screenshots for visible changes. Call out firmware, packet-format, or preference-schema impacts.

## Security & Configuration

Never commit credentials, secrets, venue-specific addresses, virtual environments, caches, or `.DS_Store`. Existing firmware contains hard-coded Wi-Fi credentials; remove or rotate them when that code is touched and move configuration out of source. Do not assign static school-network addresses without confirming DHCP ranges and network policy; prefer a DHCP reservation for a fixed venue.
