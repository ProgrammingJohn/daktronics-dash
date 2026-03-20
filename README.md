# Daktronics Dash

Daktronics Dash is a Flask backend + web UI for live scoreboard overlays. It supports:

- `live` mode: backend connects to ESP32 over TCP and ingests scoreboard data
- `manual` mode: operator updates scoreboard state from the UI
- SVG template customization and rendering for OBS overlays

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 main.py
```

Open `http://127.0.0.1:5001/`.

## Backend Refactor (Part 1)

The backend now uses a small layered structure:

- `services/esp32_client.py`: TCP client + protocol handling (JSON lines + legacy RTD framing)
- `services/sport_parsers.py`: sport-specific payload parsing into a normalized state shape
- `services/state_store.py`: thread-safe in-memory source of truth
- `services/runtime.py`: session lifecycle (`live` / `manual`) and connection orchestration
- `services/svg_templates.py`: SVG template load/render/upload/download
- `routes/api.py`: new APIs + legacy compatibility routes

Configuration is in `backend_config.json`.

## Protocol Notes

Supported ingest formats:

1. `json_v1` (recommended): newline-delimited JSON with `hello`, `data`, `heartbeat`, and backend `ack`
2. `legacy`: current ESP framing between `0x01 ... 0x04`

In `manual` mode, incoming live packets are stored but do not overwrite active display state.

## API

New endpoints include:

- `/api/session/start`
- `/api/session/stop`
- `/api/state`
- `/api/control-mode`
- `/api/manual-update`
- `/api/connection`
- `/api/health`
- `/api/templates/*`
- `/api/preferences/<sport>`

Legacy endpoints under `/api/scoreboard-service/*` and existing scoreboard/template endpoints are still available for frontend compatibility.

## Migration Note

- Keep using the wizard IP/port fields: backend connects to the operator-entered ESP32 address in live mode.
- Existing ESP firmware continues to work via legacy framing.
- For full reliability behavior (hello/ACK/retry/heartbeat), update ESP firmware to send `json_v1` packets.
- Frontend part 2 should move to `/api/state`, `/api/control-mode`, `/api/manual-update`, and `/api/connection`.
