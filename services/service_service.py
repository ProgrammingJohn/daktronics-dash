from __future__ import annotations

from typing import Any, Dict, List, Optional

from services.config import BackendConfig, load_config
from services.models import SUPPORTED_SPORTS
from services.preferences import get_preferences, scoreboard_modes as build_scoreboard_modes, update_preferences
from services.runtime import RuntimeManager
from services.svg_templates import SvgTemplateService

_config: BackendConfig = load_config()
_runtime = RuntimeManager(_config)
_svg_templates = SvgTemplateService(_config)

scoreboards: List[str] = list(SUPPORTED_SPORTS)
scoreboard_modes: Dict[str, Dict[str, bool]] = build_scoreboard_modes()


def get_backend_config() -> BackendConfig:
    return _config


def get_runtime() -> RuntimeManager:
    return _runtime


def get_svg_service() -> SvgTemplateService:
    return _svg_templates


def load_scoreboard(scoreboard_name: str) -> Optional[str]:
    return _svg_templates.load_template(scoreboard_name)


def get_scoreboard_names() -> List[str]:
    names = []
    for filename in _svg_templates.list_templates():
        names.append(filename[:-4] if filename.lower().endswith(".svg") else filename)
    if not names:
        return list(SUPPORTED_SPORTS)
    return sorted(set(names))


def get_scoreboard_preferences(scoreboard_name: str) -> Optional[Dict[str, Any]]:
    return get_preferences(_config, scoreboard_name)


def update_scoreboard_preferences(preferences: Dict[str, Any], scoreboard_name: str) -> Dict[str, Any]:
    return update_preferences(_config, scoreboard_name, preferences)
