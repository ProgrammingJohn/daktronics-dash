from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any, Dict, Optional

from services.config import BackendConfig
from services.models import SUPPORTED_SPORTS

_lock = threading.Lock()


def _default_preferences() -> Dict[str, Dict[str, Any]]:
    return {
        sport: {
            "home_team_name": "HOME",
            "home_team_light": "#0061ff",
            "home_team_dark": "#0042aa",
            "home_team_text": "#ffffff",
            "away_team_name": "AWAY",
            "away_team_light": "#ff4013",
            "away_team_dark": "#b51a00",
            "away_team_text": "#ffffff",
        }
        for sport in SUPPORTED_SPORTS
    }


def _load_preferences(path: Path) -> Dict[str, Dict[str, Any]]:
    if not path.exists():
        return _default_preferences()

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _default_preferences()

    if not isinstance(data, dict):
        return _default_preferences()

    merged = _default_preferences()
    for sport, values in data.items():
        if sport in merged and isinstance(values, dict):
            merged[sport].update(values)
    return merged


def _write_preferences(path: Path, payload: Dict[str, Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def get_all_preferences(config: BackendConfig) -> Dict[str, Dict[str, Any]]:
    with _lock:
        return _load_preferences(config.preferences_path)


def get_preferences(config: BackendConfig, sport: str) -> Optional[Dict[str, Any]]:
    sport = sport.lower()
    with _lock:
        preferences = _load_preferences(config.preferences_path)
    return preferences.get(sport)


def update_preferences(config: BackendConfig, sport: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    sport = sport.lower()
    with _lock:
        preferences = _load_preferences(config.preferences_path)
        if sport not in preferences:
            preferences[sport] = {}
        preferences[sport].update(updates)
        _write_preferences(config.preferences_path, preferences)
        return preferences[sport]


def scoreboard_modes() -> Dict[str, Dict[str, bool]]:
    return {sport: {"synced": True, "manual": True} for sport in SUPPORTED_SPORTS}
