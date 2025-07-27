import socket

def connect_to_server(ip, port):
    """Establish a TCP connection to the server."""
    tcp_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    tcp_socket.connect((ip, port))
    return tcp_socket

def receive_rtd(tcp_socket):
    """Receive a full message framed between 0x01 (start) and 0x04 (end)."""
    rtd = b''
    
    # Wait for start byte (0x01)
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
    
    return rtd.decode()

class SportsPresets:
    basketball_preset = {
        'home_score': 0,
        'away_score': 0,
        'home_fouls': 0,
        'away_fouls': 0,
        'home_bonus': False,
        'away_bonus': False,
        'home_timeouts': 5,
        'away_timeouts': 5,
        'period': 1,
        'main_clock': '0:00'
    }

class RtdParser:
    def __init__(self, sport):
        self.sport = sport
    
    def parse(self, rtd):
        if self.sport == "basketball":
            return self.parse_basketball(rtd)
        elif self.sport == "baseball":
            return self.parse_baseball(rtd)
        else:
            raise ValueError("Unsupported sport")
    
    def parse_basketball(self, rtd):
        main_clock = rtd[0:5].strip() 
        home_score = rtd[12:15].strip()
        away_score = rtd[15:18].strip()
        home_fouls = rtd[18:20].strip()
        away_fouls = rtd[20:22].strip()
        home_timeouts = rtd[24].strip()
        away_timeouts = rtd[27].strip()
        period = rtd[28].strip()

        main_clock = main_clock if main_clock != "" else SportsPresets.basketball_preset['main_clock']
        home_score = home_score if home_score != "" else SportsPresets.basketball_preset['home_score']
        away_score = away_score if away_score != "" else SportsPresets.basketball_preset['away_score']
        home_fouls = home_fouls if home_fouls != "" else SportsPresets.basketball_preset['home_fouls']
        away_fouls = away_fouls if away_fouls != "" else SportsPresets.basketball_preset['away_fouls']
        home_timeouts = home_timeouts if home_timeouts != "" else SportsPresets.basketball_preset['home_timeouts']
        away_timeouts = away_timeouts if away_timeouts != "" else SportsPresets.basketball_preset['away_timeouts']
        period = period if period != "" else SportsPresets.basketball_preset['period']

        return {
            'clock': main_clock,
            'home_score': home_score,
            'away_score': away_score,
            'home_fouls': home_fouls,
            'away_fouls': away_fouls,
            'home_bonus': int(away_fouls) >= 5,
            'away_bonus': int(home_fouls) >= 5,
            'home_timeouts': home_timeouts,
            'away_timeouts': away_timeouts,
            'period': period
        }