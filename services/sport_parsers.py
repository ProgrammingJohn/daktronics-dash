from __future__ import annotations

from typing import Any, Dict, Optional


def _to_int(value: Any, default: int = 0, minimum: int = 0, maximum: Optional[int] = None) -> int:
    try:
        output = int(str(value).strip())
    except (TypeError, ValueError):
        output = default

    if output < minimum:
        output = minimum
    if maximum is not None and output > maximum:
        output = maximum
    return output


def _to_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    text = str(value).strip().lower()
    if text in {"1", "true", "t", "yes", "y", "home", ">"}:
        return True
    if text in {"0", "false", "f", "no", "n", "away", "<"}:
        return False
    return default


def _parse_clock(value: Any, default_minutes: str = "00", default_seconds: str = "00") -> Dict[str, str]:
    if isinstance(value, dict):
        minutes = str(value.get("minutes", default_minutes)).strip() or default_minutes
        seconds = str(value.get("seconds", default_seconds)).strip() or default_seconds
    else:
        text = str(value or "").strip()
        if ":" in text:
            minutes, seconds = text.split(":", 1)
        else:
            minutes, seconds = default_minutes, default_seconds
        minutes = minutes.strip() or default_minutes
        seconds = seconds.strip() or default_seconds

    seconds = str(_to_int(seconds, default=_to_int(default_seconds, default=0), minimum=0, maximum=59)).zfill(2)
    if minutes.isdigit():
        minutes = str(_to_int(minutes, default=_to_int(default_minutes, default=0), minimum=0, maximum=99))

    return {"minutes": minutes, "seconds": seconds}


def _clock_text(clock: Dict[str, str]) -> str:
    return f"{clock['minutes']}:{clock['seconds']}"


def _safe_slice(text: str, start: int, end: Optional[int] = None, default: str = "") -> str:
    if end is None:
        end = start + 1
    try:
        return text[start:end].strip()
    except Exception:
        return default


def _parse_basketball(payload: Any) -> Dict[str, Any]:
    if isinstance(payload, dict):
        clock = _parse_clock(payload.get("clock") or payload.get("clock_text") or "0:00", default_minutes="0")
        home_score = _to_int(payload.get("home_score"), default=0, minimum=0)
        away_score = _to_int(payload.get("away_score"), default=0, minimum=0)
        home_fouls = _to_int(payload.get("home_fouls"), default=0, minimum=0)
        away_fouls = _to_int(payload.get("away_fouls"), default=0, minimum=0)
        home_timeouts = _to_int(payload.get("home_timeouts"), default=5, minimum=0, maximum=5)
        away_timeouts = _to_int(payload.get("away_timeouts"), default=5, minimum=0, maximum=5)
        period = _to_int(payload.get("period"), default=1, minimum=0)
    else:
        raw = str(payload or "")
        clock = _parse_clock(_safe_slice(raw, 0, 5, "0:00"), default_minutes="0")
        home_score = _to_int(_safe_slice(raw, 12, 15, "0"), minimum=0)
        away_score = _to_int(_safe_slice(raw, 15, 18, "0"), minimum=0)
        home_fouls = _to_int(_safe_slice(raw, 18, 20, "0"), minimum=0)
        away_fouls = _to_int(_safe_slice(raw, 20, 22, "0"), minimum=0)
        home_timeouts = _to_int(_safe_slice(raw, 24, 25, "5"), default=5, minimum=0, maximum=5)
        away_timeouts = _to_int(_safe_slice(raw, 27, 28, "5"), default=5, minimum=0, maximum=5)
        period = _to_int(_safe_slice(raw, 28, 29, "1"), default=1, minimum=0)

    return {
        "clock": clock,
        "clock_text": _clock_text(clock),
        "home_score": home_score,
        "away_score": away_score,
        "home_fouls": home_fouls,
        "away_fouls": away_fouls,
        "home_bonus": away_fouls >= 5,
        "away_bonus": home_fouls >= 5,
        "home_timeouts": home_timeouts,
        "away_timeouts": away_timeouts,
        "period": period,
    }


def _parse_baseball(payload: Any) -> Dict[str, Any]:
    if isinstance(payload, dict):
        home_score = _to_int(payload.get("home_score"), default=0, minimum=0)
        away_score = _to_int(payload.get("away_score"), default=0, minimum=0)
        inning = _to_int(payload.get("inning") or payload.get("innings"), default=1, minimum=1)
        inning_half = str(payload.get("inning_half") or "top").strip().lower()
        if inning_half not in {"top", "bot"}:
            inning_half = "top"
        strikes = _to_int(payload.get("strikes"), default=0, minimum=0, maximum=2)
        balls = _to_int(payload.get("balls"), default=0, minimum=0, maximum=3)
        outs = _to_int(payload.get("outs"), default=0, minimum=0, maximum=2)
        base_one = _to_bool(payload.get("base_one"), default=False)
        base_two = _to_bool(payload.get("base_two"), default=False)
        base_three = _to_bool(payload.get("base_three"), default=False)
    else:
        raw = str(payload or "")
        parts = [segment.strip() for segment in raw.split(",")]
        if len(parts) < 10:
            parts.extend([""] * (10 - len(parts)))

        home_score = _to_int(parts[0], default=0, minimum=0)
        away_score = _to_int(parts[1], default=0, minimum=0)
        inning = _to_int(parts[2], default=1, minimum=1)
        inning_half = (parts[3] or "top").lower()
        if inning_half not in {"top", "bot"}:
            inning_half = "top"
        strikes = _to_int(parts[4], default=0, minimum=0, maximum=2)
        balls = _to_int(parts[5], default=0, minimum=0, maximum=3)
        outs = _to_int(parts[6], default=0, minimum=0, maximum=2)
        base_one = _to_bool(parts[7], default=False)
        base_two = _to_bool(parts[8], default=False)
        base_three = _to_bool(parts[9], default=False)

    return {
        "home_score": home_score,
        "away_score": away_score,
        "inning": inning,
        "inning_half": inning_half,
        "balls": balls,
        "strikes": strikes,
        "outs": outs,
        "base_one": base_one,
        "base_two": base_two,
        "base_three": base_three,
        "inning_text": f"{inning_half} {inning}",
        "strikes_and_balls": f"{balls} - {strikes}",
        "out_text": f"{outs} outs",
    }


def _parse_football(payload: Any) -> Dict[str, Any]:
    if isinstance(payload, dict):
        clock = _parse_clock(payload.get("clock") or payload.get("clock_text") or "00:00")
        home_score = _to_int(payload.get("home_score"), default=0, minimum=0)
        away_score = _to_int(payload.get("away_score"), default=0, minimum=0)
        period = _to_int(payload.get("period"), default=1, minimum=0)
        down = _to_int(payload.get("down"), default=1, minimum=1, maximum=4)
        yards_to_go = _to_int(payload.get("yards_to_go") or payload.get("yards"), default=10, minimum=0)
        home_timeouts = _to_int(payload.get("home_timeouts"), default=3, minimum=0, maximum=3)
        away_timeouts = _to_int(payload.get("away_timeouts"), default=3, minimum=0, maximum=3)
        home_possession = _to_bool(payload.get("home_possesion") or payload.get("possession"), default=True)
    else:
        raw = str(payload or "")
        clock = _parse_clock(_safe_slice(raw, 0, 5, "00:00"))
        home_score = _to_int(_safe_slice(raw, 25, 27, "0"), minimum=0)
        away_score = _to_int(_safe_slice(raw, 27, 29, "0"), minimum=0)
        period = _to_int(_safe_slice(raw, 29, 30, "1"), default=1, minimum=0)
        down = _to_int(_safe_slice(raw, 32, 33, "1"), default=1, minimum=1, maximum=4)
        yards_to_go = _to_int(_safe_slice(raw, 33, 35, "10"), default=10, minimum=0)
        home_timeouts = _to_int(_safe_slice(raw, 39, 40, "3"), default=3, minimum=0, maximum=3)
        away_timeouts = _to_int(_safe_slice(raw, 40, 41, "3"), default=3, minimum=0, maximum=3)
        home_possession = _to_bool(_safe_slice(raw, 36, 37, ">"), default=True)

    return {
        "clock": clock,
        "clock_text": _clock_text(clock),
        "home_score": home_score,
        "away_score": away_score,
        "period": period,
        "down": down,
        "yards_to_go": yards_to_go,
        "yards": yards_to_go,
        "home_timeouts": home_timeouts,
        "away_timeouts": away_timeouts,
        "home_possesion": home_possession,
        "possession": "home" if home_possession else "away",
    }


class SportParsers:
    """Normalize sport-specific payloads into one scoreboard schema."""

    def __init__(self) -> None:
        self._parsers = {
            "basketball": _parse_basketball,
            "baseball": _parse_baseball,
            "football": _parse_football,
        }

    def parse(self, sport: str, payload: Any) -> Dict[str, Any]:
        sport = (sport or "").lower()
        parser = self._parsers.get(sport)
        if parser is None:
            raise ValueError(f"Unsupported sport: {sport}")
        parsed = parser(payload)
        parsed["sport"] = sport
        return parsed
