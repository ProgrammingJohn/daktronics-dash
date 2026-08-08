from typing import Dict
import json
import os
from pathlib import Path
import shutil

from services.resources import application_resource_path


def scoreboard_preferences_path() -> Path:
    bundled_path = application_resource_path(
        "scoreboard_svgs", "scoreboard_preferences.json"
    )
    data_directory = os.environ.get("DAKDASH_DATA_DIR")
    if not data_directory:
        return bundled_path

    user_data_path = Path(data_directory).expanduser().resolve()
    user_data_path.mkdir(parents=True, exist_ok=True)
    preferences_path = user_data_path / "scoreboard_preferences.json"
    if not preferences_path.exists():
        shutil.copyfile(bundled_path, preferences_path)
    return preferences_path

def get_scoreboard_preferences() -> Dict:
    with scoreboard_preferences_path().open("r", encoding="utf-8") as preferences_file:
        return json.load(preferences_file)

def write_scorebaord_preferences(preferences) -> None:
    with scoreboard_preferences_path().open("w", encoding="utf-8") as preferences_file:
        json.dump(preferences, preferences_file)

baseball_preset = {'home_score': 0, 'away_score': 0, 'strikes': 0, 'balls': 0, 'outs': 0, 'innings': 1, 'top_of_inning': True, 'bases': [False, False, False]}
