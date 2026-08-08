from typing import Any, Dict


class FrameParseError(ValueError):
    """Raised when a validated transport payload cannot be parsed as a sport frame."""


_BASKETBALL_DEFAULTS = {
    "clock": {"minutes": 0, "seconds": 0},
    "home_score": 0,
    "away_score": 0,
    "home_fouls": 0,
    "away_fouls": 0,
    "home_timeouts": 5,
    "away_timeouts": 5,
    "period": 1,
}

_BASEBALL_DEFAULTS = {
    "home_score": 0,
    "away_score": 0,
    "inning": 1,
    "half": "top",
    "strikes": 0,
    "balls": 0,
    "outs": 0,
    "base_one": False,
    "base_two": False,
    "base_three": False,
}

_FOOTBALL_DEFAULTS = {
    "clock": {"minutes": 0, "seconds": 0},
    "home_score": 0,
    "away_score": 0,
    "period": 1,
    "down": 1,
    "yards_to_go": 10,
    "home_timeouts": 3,
    "away_timeouts": 3,
    "home_possesion": True,
}


def parse_scoreboard_frame(sport: str, payload: bytes) -> Dict[str, Any]:
    """Parse one validated scoreboard payload into canonical score data."""
    text = _decode_ascii(payload)

    if sport == "basketball":
        return _parse_basketball(text)
    if sport == "baseball":
        return _parse_baseball(text)
    if sport == "football":
        return _parse_football(text)
    raise FrameParseError("Unsupported sport: {}".format(sport))


def _decode_ascii(payload: bytes) -> str:
    if not isinstance(payload, bytes):
        raise FrameParseError("Scoreboard payload must be bytes")
    try:
        return payload.decode("ascii")
    except UnicodeDecodeError as error:
        raise FrameParseError("Scoreboard payload must be ASCII") from error


def _require_minimum_length(text: str, sport: str, minimum_length: int) -> None:
    if len(text) < minimum_length:
        raise FrameParseError(
            "{} frame must be at least {} characters".format(sport, minimum_length)
        )


def _parse_integer(value: str, default: int, field: str) -> int:
    value = value.strip()
    if not value:
        return default
    try:
        return int(value)
    except ValueError as error:
        raise FrameParseError("Invalid integer for {}".format(field)) from error


def _parse_clock(value: str, default: Dict[str, int], field: str) -> Dict[str, int]:
    value = value.strip()
    if not value:
        return dict(default)
    pieces = value.split(":")
    if len(pieces) != 2 or not pieces[0] or not pieces[1]:
        raise FrameParseError("Invalid clock for {}".format(field))
    return {
        "minutes": _parse_integer(pieces[0], 0, "{}_minutes".format(field)),
        "seconds": _parse_integer(pieces[1], 0, "{}_seconds".format(field)),
    }


def _parse_basketball(text: str) -> Dict[str, Any]:
    _require_minimum_length(text, "basketball", 29)
    defaults = _BASKETBALL_DEFAULTS
    home_fouls = _parse_integer(text[18:20], defaults["home_fouls"], "home_fouls")
    away_fouls = _parse_integer(text[20:22], defaults["away_fouls"], "away_fouls")
    return {
        "clock": _parse_clock(text[0:5], defaults["clock"], "clock"),
        "home_score": _parse_integer(text[12:15], defaults["home_score"], "home_score"),
        "away_score": _parse_integer(text[15:18], defaults["away_score"], "away_score"),
        "home_fouls": home_fouls,
        "away_fouls": away_fouls,
        "home_bonus": away_fouls >= 5,
        "away_bonus": home_fouls >= 5,
        "home_timeouts": _parse_integer(
            text[24], defaults["home_timeouts"], "home_timeouts"
        ),
        "away_timeouts": _parse_integer(
            text[27], defaults["away_timeouts"], "away_timeouts"
        ),
        "period": _parse_integer(text[28], defaults["period"], "period"),
    }


def _parse_baseball(text: str) -> Dict[str, Any]:
    parts = text.split(",")
    if len(parts) != 10:
        raise FrameParseError("baseball frame must contain 10 CSV fields")
    defaults = _BASEBALL_DEFAULTS
    half = parts[3].strip() or defaults["half"]
    strikes = _parse_integer(parts[4], defaults["strikes"], "strikes")
    balls = _parse_integer(parts[5], defaults["balls"], "balls")
    return {
        "home_score": _parse_integer(parts[0], defaults["home_score"], "home_score"),
        "away_score": _parse_integer(parts[1], defaults["away_score"], "away_score"),
        "inning_text": "{} {}".format(
            half, _parse_integer(parts[2], defaults["inning"], "inning")
        ),
        "strikes_and_balls": "{} - {}".format(balls, strikes),
        "out_text": "{} outs".format(
            _parse_integer(parts[6], defaults["outs"], "outs")
        ),
        "base_one": _parse_base(parts[7], defaults["base_one"], "base_one"),
        "base_two": _parse_base(parts[8], defaults["base_two"], "base_two"),
        "base_three": _parse_base(parts[9], defaults["base_three"], "base_three"),
    }


def _parse_base(value: str, default: bool, field: str) -> bool:
    value = _parse_integer(value, int(default), field)
    if value not in (0, 1):
        raise FrameParseError("Invalid base indicator for {}".format(field))
    return bool(value)


def _parse_football(text: str) -> Dict[str, Any]:
    _require_minimum_length(text, "football", 41)
    defaults = _FOOTBALL_DEFAULTS
    possession = text[36].strip()
    if not possession:
        home_possesion = defaults["home_possesion"]
    elif possession == ">":
        home_possesion = False
    elif possession == "<":
        home_possesion = True
    else:
        raise FrameParseError("Invalid possession indicator")
    return {
        "clock": _parse_clock(text[0:5], defaults["clock"], "clock"),
        "home_score": _parse_integer(text[25:27], defaults["home_score"], "home_score"),
        "away_score": _parse_integer(text[27:29], defaults["away_score"], "away_score"),
        "period": _parse_integer(text[29], defaults["period"], "period"),
        "down": _parse_integer(text[32], defaults["down"], "down"),
        "yards_to_go": _parse_integer(text[33:35], defaults["yards_to_go"], "yards_to_go"),
        "home_timeouts": _parse_integer(
            text[39], defaults["home_timeouts"], "home_timeouts"
        ),
        "away_timeouts": _parse_integer(
            text[40], defaults["away_timeouts"], "away_timeouts"
        ),
        "home_possesion": home_possesion,
    }
