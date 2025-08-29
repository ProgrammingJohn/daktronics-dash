import socket

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
        'clock': {'minutes': '00', 'seconds': '00'},
        'period': 1,
        'down': 1,
        'yards': 10,
        'home_timeouts': 3,
        'away_timeouts': 3,
        'home_possesion': True
    }
def safe_parse(string: str, default: str, start_index: int, end_index: int = None):
    if not end_index:
        end_index = start_index + 1
    try:
        return string[start_index : end_index].strip()
    except:
        return default

class RtdParser:
    def __init__(self, sport):
        self.sport = sport
    
    def parse(self, rtd):
        if self.sport == "basketball":
            return self.parse_basketball(rtd)
        elif self.sport == "baseball":
            return self.parse_baseball(rtd)
        elif self.sport == "football":
            return self.parse_football(rtd)
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

    def parse_baseball(self, rtd):
        try:
            parts = rtd.split(',')
            home_score = parts[0]
            away_score = parts[1]
            inning = parts[2]
            half = parts[3]
            strikes = parts[4]
            balls = parts[5]
            outs = parts[6]
            bases = parts[7:10]
        except Exception:
            return SportsPresets.baseball_preset

        return {
            'home_score': home_score or SportsPresets.baseball_preset['home_score'],
            'away_score': away_score or SportsPresets.baseball_preset['away_score'],
            'inning_text': f"{half} {inning}",
            'strikes_and_balls': f"{balls} - {strikes}",
            'out_text': f"{outs} outs",
            'base_one': bases[0] == '1' if len(bases) > 0 else False,
            'base_two': bases[1] == '1' if len(bases) > 1 else False,
            'base_three': bases[2] == '1' if len(bases) > 2 else False,
        }
    
    def parse_football(self, rtd):
        sport = SportsPresets.football_preset
        
        clock = safe_parse(rtd, {'minutes': '00', 'seconds': '00'}, 0, 5)
        try:
            clock = {'minutes': clock.split(':')[0], 'seconds': clock.split(':')[1]}
        except:
            clock = {'minutes': '00', 'seconds': '00'}
        home_score = safe_parse(rtd, sport['home_score'], 25, 27)
        away_score = safe_parse(rtd, sport['away_score'], 27, 29)
        period = safe_parse(rtd, sport['period'], 29, 30)
        down = safe_parse(rtd, sport['down'], 32, 33)
        yards = safe_parse(rtd, sport['yards'], 33, 35)
        home_timeouts = safe_parse(rtd, sport['home_timeouts'], 39, 40)
        away_timeouts = safe_parse(rtd, sport['away_timeouts'], 40, 41)
        home_possesion = safe_parse(rtd, sport['home_possesion'], 36, 37)
        home_possesion = True if home_possesion == ">" else False
        
        print(clock, home_score, away_score, period, down, yards, home_timeouts, away_timeouts, home_possesion)


        return {
            'clock': clock,
            'home_score': home_score,
            'away_score': away_score,
            'period': period,
            'down': down,
            'yards': yards,
            'home_timeouts': home_timeouts,
            'away_timeouts': away_timeouts,
            'home_possesion': home_possesion
        }
# 12:00HOME      GUEST     2233146311 >403330

if __name__ == "__main__":
    rtd = "12:00HOME      GUEST     2233146311  403339"
    print(RtdParser("football").parse_football(rtd))