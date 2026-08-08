# Daktronics Dash

Daktronics Dash is a simple Flask based tool for broadcasting sports scores.
It supports manual scoring through a web UI and can sync with a Daktronics
controller via an ESP32.

## Running

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Then open `http://127.0.0.1:5000/` in your browser.

## Development

Scoreboards live in `scoreboard_svgs/` and their preferences are stored in
`scoreboard_svgs/scoreboard_preferences.json`.

The `static/js` folder contains the wizard logic and manual scoring handlers.

### Electron operator console

The Electron application runs the React operator console and the Flask API as
one local application. It keeps the OBS viewer available at:

```text
http://127.0.0.1:58321/viewer
```

Run an unpackaged development build with:

```bash
cd desktop
npm ci
npm run electron:dev
```

Appearance preferences are stored in the current macOS user's Electron app-data
directory. Connection IP, port, and device ID continue to be entered by the
operator and persisted locally; no venue values are compiled into the app.

## Building the universal macOS app

The release build requires Xcode command-line tools, Node 22, plus native Python
interpreters for both Apple Silicon and Intel. The defaults on the build Mac are
`/opt/homebrew/opt/node@22/bin` for Node, `/opt/homebrew/bin/python3` for arm64, and
`/Library/Frameworks/Python.framework/Versions/3.9/bin/python3` for x64. Override
them with `DAKDASH_NODE_BIN_PATH`, `DAKDASH_PYTHON_ARM64`, and
`DAKDASH_PYTHON_X64` when needed.

```bash
./scripts/build_macos_universal.sh
```

The command produces `release/DakDash-macos-universal.zip`. The bundle contains
both backend architectures and does not require Python, Node.js, or Rosetta on
the destination Mac.

This internal build is ad-hoc signed but not Developer ID signed or notarized.
After downloading it, the operator must extract it, right-click `DakDash.app`,
choose **Open**, and confirm the first launch. Automatic updates are intentionally
not enabled for this unsigned distribution. The current build targets macOS 12
or newer.
