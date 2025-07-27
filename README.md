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
