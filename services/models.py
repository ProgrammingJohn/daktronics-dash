from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict

SUPPORTED_SPORTS = ("baseball", "basketball", "football")
CONTROL_MODES = ("live", "manual")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def base_state(sport: str, control_mode: str) -> Dict[str, Any]:
    """Create the default normalized scoreboard state for a given sport."""
    state: Dict[str, Any] = {
        "sport": sport,
        "home_score": 0,
        "away_score": 0,
        "period": 1,
        "clock": {"minutes": "00", "seconds": "00"},
        "clock_text": "0:00",
        "possession": "home",
        "home_possesion": True,  # compatibility typo used by the current frontend
        "down": 1,
        "yards_to_go": 10,
        "yards": 10,
        "balls": 0,
        "strikes": 0,
        "outs": 0,
        "inning": 1,
        "inning_half": "top",
        "home_fouls": 0,
        "away_fouls": 0,
        "home_timeouts": 3,
        "away_timeouts": 3,
        "home_bonus": False,
        "away_bonus": False,
        "base_one": False,
        "base_two": False,
        "base_three": False,
        "inning_text": "top 1",
        "strikes_and_balls": "0 - 0",
        "out_text": "0 outs",
        "raw_source_data": None,
        "source": "manual",
        "control_mode": control_mode,
        "last_update_time": now_iso(),
        "connection_status": "stopped",
    }

    if sport == "basketball":
        state.update(
            {
                "clock": {"minutes": "0", "seconds": "00"},
                "clock_text": "0:00",
                "period": 1,
                "home_timeouts": 5,
                "away_timeouts": 5,
            }
        )
    elif sport == "football":
        state.update(
            {
                "clock": {"minutes": "00", "seconds": "00"},
                "clock_text": "00:00",
                "period": 1,
                "down": 1,
                "yards_to_go": 10,
                "yards": 10,
                "home_timeouts": 3,
                "away_timeouts": 3,
                "home_possesion": True,
                "possession": "home",
            }
        )
    elif sport == "baseball":
        state.update(
            {
                "period": 1,
                "inning": 1,
                "inning_half": "top",
                "inning_text": "top 1",
                "balls": 0,
                "strikes": 0,
                "outs": 0,
                "strikes_and_balls": "0 - 0",
                "out_text": "0 outs",
                "base_one": False,
                "base_two": False,
                "base_three": False,
            }
        )

    return state


def deep_copy_state(state: Dict[str, Any]) -> Dict[str, Any]:
    return deepcopy(state)
