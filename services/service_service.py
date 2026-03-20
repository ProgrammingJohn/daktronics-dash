import threading
import os, sys, time
from copy import deepcopy
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
    @staticmethod
    def build_default_telemetry(ip=None, port=None, status="stopped"):
        return {
            "status": status,
            "ip": ip,
            "port": port,
            "connect_rtt_ms": None,
            "packets_received": 0,
            "packets_dropped": 0,
            "parse_errors": 0,
            "reconnect_count": 0,
            "connected_since_ms": None,
            "last_packet_at_ms": None,
            "last_error": None,
        }

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
        self.last_score = {}
        self.telemetry = self.build_default_telemetry(
            ip=self.ip, port=self.port, status="stopped"
        )
        self._has_connected_once = False
        self._freshness_threshold_ms = 7000

    @staticmethod
    def _now_ms():
        return int(time.time() * 1000)

    def _set_status(self, status):
        self.status = status
        self.telemetry["status"] = status

    def update_scoreboard_data(self, new_data):
        global global_scoreboard_data
        global_scoreboard_data = new_data

    def get_scoreboard_data(self):
        global global_scoreboard_data
        return global_scoreboard_data

    def get_status(self):
        return self.status

    def get_telemetry(self):
        telemetry = deepcopy(self.telemetry)
        last_packet_at = telemetry.get("last_packet_at_ms")
        if last_packet_at is None:
            telemetry["last_packet_age_ms"] = None
        else:
            telemetry["last_packet_age_ms"] = max(0, self._now_ms() - last_packet_at)
        telemetry["data_fresh"] = (
            telemetry["last_packet_age_ms"] is not None
            and telemetry["last_packet_age_ms"] <= self._freshness_threshold_ms
        )
        return telemetry

    def run(self):
        global global_scoreboard_data
        if self.is_dakdash_synced:
            self.parser = RtdParser(self.scoreboard_name)
            self.last_score = self.parser.default_score()
            global_scoreboard_data = deepcopy(self.last_score)

            while self.running:
                try:
                    print(f"Connecting to {self.ip}:{self.port}")
                    self._set_status("connecting")
                    connect_start = time.perf_counter()
                    with connect_to_server(self.ip, self.port) as tcp_socket:
                        connect_rtt_ms = int((time.perf_counter() - connect_start) * 1000)
                        self._set_status("connected")
                        self.telemetry["connect_rtt_ms"] = connect_rtt_ms
                        self.telemetry["connected_since_ms"] = self._now_ms()
                        self.telemetry["last_error"] = None
                        if self._has_connected_once:
                            self.telemetry["reconnect_count"] += 1
                        else:
                            self._has_connected_once = True
                        print(f"Connected to {self.ip}:{self.port}")
                        
                        while self.running:
                            rtd = receive_rtd(tcp_socket)
                            if rtd is None:
                                self.telemetry["packets_dropped"] += 1
                                continue
                            try:
                                self.last_score = self.parser.parse(rtd, self.last_score)
                                global_scoreboard_data = deepcopy(self.last_score)
                                self.telemetry["packets_received"] += 1
                                self.telemetry["last_packet_at_ms"] = self._now_ms()
                            except Exception as parse_error:
                                self.telemetry["parse_errors"] += 1
                                self.telemetry["last_error"] = (
                                    f"{type(parse_error).__name__}: {parse_error}"
                                )
                                print(f"Failed to parse RTD frame: {parse_error}")
                except ConnectionRefusedError as connect_error:
                    self._set_status("disconnected")
                    self.telemetry["connected_since_ms"] = None
                    self.telemetry["last_error"] = (
                        f"{type(connect_error).__name__}: {connect_error}"
                    )
                    print(f"Failed to connect to {self.ip}:{self.port}")
                except OSError as connect_error:
                    self._set_status("disconnected")
                    self.telemetry["connected_since_ms"] = None
                    self.telemetry["last_error"] = (
                        f"{type(connect_error).__name__}: {connect_error}"
                    )
                    print(f"Failed to connect to {self.ip}:{self.port}")
                time.sleep(1)
        else:
            self._set_status("manual")
            while self.running:
                time.sleep(0.1)

    def stop(self):
        global global_scoreboard_data
        print("scoreboard service stop call")
        global_scoreboard_data = {}
        self.running = False
        self._set_status("stopped")
        self.telemetry["connected_since_ms"] = None

    def mock_score_update(self):
        return {"home": 10, "away": 15}


active_thread: ScoreboardService = None
