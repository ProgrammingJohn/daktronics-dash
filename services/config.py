from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Union


@dataclass
class BackendConfig:
    tcp_connect_timeout_sec: float = 3.0
    socket_timeout_sec: float = 1.0
    reconnect_delay_sec: float = 1.0
    stale_timeout_sec: float = 8.0
    seq_cache_size: int = 256
    svg_dir: str = "scoreboard_svgs"
    preferences_file: str = "scoreboard_preferences.json"
    max_svg_upload_bytes: int = 1_048_576
    log_level: str = "INFO"

    @property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parent.parent

    @property
    def svg_path(self) -> Path:
        return self.project_root / self.svg_dir

    @property
    def preferences_path(self) -> Path:
        return self.svg_path / self.preferences_file


def _merge_config(default_cfg: BackendConfig, loaded: Dict[str, Any]) -> BackendConfig:
    payload = asdict(default_cfg)
    for key, value in loaded.items():
        if key in payload:
            payload[key] = value
    return BackendConfig(**payload)


def load_config(config_path: Optional[Union[str, Path]] = None) -> BackendConfig:
    default_cfg = BackendConfig()
    if config_path is None:
        config_path = default_cfg.project_root / "backend_config.json"
    config_path = Path(config_path)

    if not config_path.exists():
        return default_cfg

    try:
        loaded = json.loads(config_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default_cfg

    if not isinstance(loaded, dict):
        return default_cfg

    return _merge_config(default_cfg, loaded)
