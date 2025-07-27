import threading
import os, sys, time
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.utils import get_scoreboard_preferences, write_scorebaord_preferences
from services.synced_service import connect_to_server, receive_rtd, RtdParser

scoreboards = ['baseball', 'basketball', 'football']
scoreboard_modes = {
    'baseball': {'synced': True, 'manual': True},
    'basketball': {'synced': True, 'manual': True},
    'football': {'synced': True, 'manual': True},
}
global_scoreboard_data = {}


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

class ScoreboardService(threading.Thread):
    def __init__(self, scoreboard_name=None, is_dakdash_synced=False, ip=None, port: int=None):
        global global_scoreboard_data
        super().__init__()
        self.ip = ip
        self.port = int(port) if port is not None else None
        self.connection = None
        self.is_dakdash_synced = is_dakdash_synced
        self.scoreboard_name = scoreboard_name
        self.running = True
        self.parser = None
        self.status = "stopped"

    def update_scoreboard_data(self, new_data):
        global global_scoreboard_data
        global_scoreboard_data = new_data

    def get_scoreboard_data(self):
        global global_scoreboard_data
        return global_scoreboard_data

    def get_status(self):
        return self.status

    def run(self):
        global global_scoreboard_data
        if self.is_dakdash_synced:
            self.parser = RtdParser(self.scoreboard_name)

            while self.running:
                try:
                    print(f"Connecting to {self.ip}:{self.port}")
                    self.status = "connecting"
                    with connect_to_server(self.ip, self.port) as tcp_socket:
                        self.status = "connected"
                        print(f"Connected to {self.ip}:{self.port}")
                        
                        while True:
                            rtd = receive_rtd(tcp_socket)
                            print(rtd)
                            global_scoreboard_data = self.parser.parse(rtd) 
                except OSError:
                    self.status = "disconnected"
                    print(f"Failed to connect to {self.ip}:{self.port}")
                except ConnectionRefusedError:
                    self.status = "disconnected"
                    print(f"Failed to connect to {self.ip}:{self.port}")
                time.sleep(1)
        else:
            self.status = "manual"
            while self.running:
                time.sleep(0.1)

    def stop(self):
        global global_scoreboard_data
        global_scoreboard_data = {}
        self.running = False
        self.status = "stopped"

    def mock_score_update(self):
        return {"home": 10, "away": 15}


active_thread: ScoreboardService = None
