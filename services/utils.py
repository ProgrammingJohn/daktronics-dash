from typing import Dict
import json
import os

def get_scoreboard_preferences() -> Dict:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "..", "scoreboard_svgs", "scoreboard_preferences.json")
    with open(file_path, "r") as f:
        return json.loads(f.read())

def write_scorebaord_preferences(preferences) -> None:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "..", "scoreboard_svgs", "scoreboard_preferences.json")
    with open(file_path, "w") as f:
        f.write(json.dumps(preferences))

baseball_preset = {'home_score': 0, 'away_score': 0, 'strikes': 0, 'balls': 0, 'outs': 0, 'innings': 1, 'top_of_inning': True, 'bases': [False, False, False]}