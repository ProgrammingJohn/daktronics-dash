import re
import socket
from copy import deepcopy

def connect_to_server(ip, port):
    """Establish a TCP connection to the server."""
    tcp_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    tcp_socket.connect((ip, port))
    return tcp_socket

def receive_rtd(tcp_socket):
    """Receive a full message framed between 0x01 (start) and 0x04 (end)."""
    rtd = b''
    tcp_socket.settimeout(5) # wait three seconds on .recv
    
    # Wait for start byte (0x01)
    try:
        while True:
            chunk = tcp_socket.recv(1024)
            if b'\x01' in chunk:
                rtd += chunk[chunk.index(b'\x01')+1:]
                break

        # Read until end byte (0x04)
        while True:
            chunk = tcp_socket.recv(1024)
            if b'\x04' in chunk:
                rtd += chunk[:chunk.index(b'\x04')]
                break
            rtd += chunk
    except socket.timeout:
        return None
    
    return rtd.decode(errors="ignore")

class SportsPresets:
    basketball_preset = {
        'clock': '0:00',
        'home_score': 0,
        'away_score': 0,
        'home_fouls': 0,
        'away_fouls': 0,
        'home_bonus': False,
        'away_bonus': False,
        'home_timeouts': 5,
        'away_timeouts': 5,
        'period': 1,
    }
    baseball_preset = {
        'home_score': 0,
        'away_score': 0,
        'inning_text': 'top 1',
        'strikes_and_balls': '0 - 0',
        'out_text': '0 outs',
        'base_one': False,
        'base_two': False,
        'base_three': False,
    }
    football_preset = {
        'home_score': 0,
        'away_score': 0,
        'clock': {'minutes': 0, 'seconds': 0},
        'period': 1,
        'down': 1,
        'yards': 10,
        'home_timeouts': 3,
        'away_timeouts': 3,
        'home_possesion': True
    }


def _slice_text(value, start_index, end_index=None):
    if end_index is None:
        end_index = start_index + 1
    if not isinstance(value, str) or start_index >= len(value):
        return None
    return value[start_index:end_index].strip()


def _parse_int(value, fallback, minimum=None, maximum=None):
    if value is None or value == "":
        return fallback
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return fallback
    if minimum is not None and parsed < minimum:
        return fallback
    if maximum is not None and parsed > maximum:
        return fallback
    return parsed

class RtdParser:
    def __init__(self, sport):
        self.sport = sport

    def default_score(self):
        if self.sport == "basketball":
            return deepcopy(SportsPresets.basketball_preset)
        if self.sport == "baseball":
            return deepcopy(SportsPresets.baseball_preset)
        if self.sport == "football":
            return deepcopy(SportsPresets.football_preset)
        raise ValueError("Unsupported sport")
    
    def parse(self, rtd, previous_score=None):
        score = deepcopy(previous_score) if isinstance(previous_score, dict) else self.default_score()
        if not isinstance(rtd, str) or rtd == "":
            return score

        if self.sport == "basketball":
            return self.parse_basketball(rtd, score)
        elif self.sport == "baseball":
            return self.parse_baseball(rtd, score)
        elif self.sport == "football":
            return self.parse_football(rtd, score)
        else:
            raise ValueError("Unsupported sport")
    
    def parse_basketball(self, rtd, score):
        clock_text = _slice_text(rtd, 0, 5)
        if isinstance(clock_text, str) and re.fullmatch(r"\d{1,2}:\d{2}", clock_text):
            score['clock'] = clock_text

        score['home_score'] = _parse_int(_slice_text(rtd, 12, 15), score['home_score'], 0, 999)
        score['away_score'] = _parse_int(_slice_text(rtd, 15, 18), score['away_score'], 0, 999)
        score['home_fouls'] = _parse_int(_slice_text(rtd, 18, 20), score['home_fouls'], 0, 99)
        score['away_fouls'] = _parse_int(_slice_text(rtd, 20, 22), score['away_fouls'], 0, 99)
        score['home_timeouts'] = _parse_int(_slice_text(rtd, 24, 25), score['home_timeouts'], 0, 5)
        score['away_timeouts'] = _parse_int(_slice_text(rtd, 27, 28), score['away_timeouts'], 0, 5)
        score['period'] = _parse_int(_slice_text(rtd, 28, 29), score['period'], 0, 9)

        score['home_bonus'] = score['away_fouls'] >= 5
        score['away_bonus'] = score['home_fouls'] >= 5
        return score

    @staticmethod
    def _parse_previous_inning(inning_text):
        if isinstance(inning_text, str):
            match = re.fullmatch(r"(top|bot)\s+(\d+)", inning_text.strip().lower())
            if match:
                return match.group(1), int(match.group(2))
        return "top", 1

    @staticmethod
    def _parse_previous_strikes_and_balls(strikes_and_balls):
        if isinstance(strikes_and_balls, str):
            match = re.fullmatch(r"(\d+)\s*-\s*(\d+)", strikes_and_balls.strip())
            if match:
                return int(match.group(1)), int(match.group(2))
        return 0, 0

    @staticmethod
    def _parse_previous_outs(out_text):
        if isinstance(out_text, str):
            match = re.fullmatch(r"(\d+)\s+outs", out_text.strip())
            if match:
                return int(match.group(1))
        return 0

    def parse_baseball(self, rtd, score):
        parts = rtd.split(',') if isinstance(rtd, str) else []

        def get_part(index):
            if index >= len(parts):
                return None
            return parts[index].strip()

        inning_half, inning_value = self._parse_previous_inning(score.get('inning_text'))
        balls_value, strikes_value = self._parse_previous_strikes_and_balls(score.get('strikes_and_balls'))
        outs_value = self._parse_previous_outs(score.get('out_text'))

        score['home_score'] = _parse_int(get_part(0), score['home_score'], 0, 999)
        score['away_score'] = _parse_int(get_part(1), score['away_score'], 0, 999)
        inning_value = _parse_int(get_part(2), inning_value, 1, 99)
        half_value = get_part(3)
        if half_value in ("top", "bot"):
            inning_half = half_value

        strikes_value = _parse_int(get_part(4), strikes_value, 0, 9)
        balls_value = _parse_int(get_part(5), balls_value, 0, 9)
        outs_value = _parse_int(get_part(6), outs_value, 0, 9)

        base_one = get_part(7)
        base_two = get_part(8)
        base_three = get_part(9)
        if base_one in ("0", "1"):
            score['base_one'] = base_one == "1"
        if base_two in ("0", "1"):
            score['base_two'] = base_two == "1"
        if base_three in ("0", "1"):
            score['base_three'] = base_three == "1"

        score['inning_text'] = f"{inning_half} {inning_value}"
        score['strikes_and_balls'] = f"{balls_value} - {strikes_value}"
        score['out_text'] = f"{outs_value} outs"
        return score

    def parse_football(self, rtd, score):
        clock_text = _slice_text(rtd, 0, 5)
        if isinstance(clock_text, str):
            match = re.fullmatch(r"(\d{1,2}):(\d{2})", clock_text)
            if match:
                minutes = int(match.group(1))
                seconds = int(match.group(2))
                if 0 <= minutes <= 99 and 0 <= seconds <= 59:
                    score['clock'] = {'minutes': minutes, 'seconds': seconds}

        score['home_score'] = _parse_int(_slice_text(rtd, 25, 27), score['home_score'], 0, 999)
        score['away_score'] = _parse_int(_slice_text(rtd, 27, 29), score['away_score'], 0, 999)
        score['period'] = _parse_int(_slice_text(rtd, 29, 30), score['period'], 0, 9)
        score['down'] = _parse_int(_slice_text(rtd, 32, 33), score['down'], 1, 4)
        score['yards'] = _parse_int(_slice_text(rtd, 33, 35), score['yards'], 0, 99)
        score['home_timeouts'] = _parse_int(_slice_text(rtd, 39, 40), score['home_timeouts'], 0, 3)
        score['away_timeouts'] = _parse_int(_slice_text(rtd, 40, 41), score['away_timeouts'], 0, 3)

        home_possesion = _slice_text(rtd, 36, 37)
        if home_possesion == ">":
            score['home_possesion'] = True
        elif home_possesion == "<":
            score['home_possesion'] = False

        return score
