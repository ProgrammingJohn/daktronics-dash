from __future__ import annotations

from typing import Dict

from services.preferences import get_all_preferences, update_preferences
from services.service_service import get_backend_config


def get_scoreboard_preferences() -> Dict:
    """Legacy helper retained for backward compatibility."""
    return get_all_preferences(get_backend_config())


def write_scorebaord_preferences(preferences: Dict) -> None:
    """Legacy helper retained for backward compatibility."""
    config = get_backend_config()
    for sport, values in preferences.items():
        if isinstance(values, dict):
            update_preferences(config, sport, values)


baseball_preset = {
    "home_score": 0,
    "away_score": 0,
    "strikes": 0,
    "balls": 0,
    "outs": 0,
    "innings": 1,
    "top_of_inning": True,
    "bases": [False, False, False],
}
