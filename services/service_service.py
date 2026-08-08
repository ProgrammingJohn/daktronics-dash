import os, sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.utils import get_scoreboard_preferences, write_scorebaord_preferences

scoreboards = ['baseball', 'basketball', 'football']
scoreboard_modes = {
    'baseball': {'synced': True, 'manual': True},
    'basketball': {'synced': True, 'manual': True},
    'football': {'synced': True, 'manual': True},
}
def load_scoreboard(scoreboard_name):
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(base_dir, "..", "scoreboard_svgs", f"{scoreboard_name}.svg")
        with open(file_path, "r") as f:
            svg = f.read()
            return svg
    except FileNotFoundError:
        return None
    
def update_scoreboard_preferences(preferences, scoreboardName):
    old_preferences = get_scoreboard_preferences()
    for key in preferences:
        old_preferences[scoreboardName][key] = preferences[key]
    write_scorebaord_preferences(old_preferences)
