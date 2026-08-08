import socket

from services.sport_parsers import FrameParseError, parse_scoreboard_frame

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

class RtdParser:
    """Compatibility adapter for callers that still provide decoded RTD text."""

    def __init__(self, sport):
        self.sport = sport

    def parse(self, rtd):
        return self._parse_for(self.sport, rtd)

    def _parse_for(self, sport, rtd):
        if isinstance(rtd, str):
            try:
                rtd = rtd.encode("ascii")
            except UnicodeEncodeError as error:
                raise FrameParseError("Scoreboard payload must be ASCII") from error
        return parse_scoreboard_frame(sport, rtd)

    def parse_basketball(self, rtd):
        return self._parse_for("basketball", rtd)

    def parse_baseball(self, rtd):
        return self._parse_for("baseball", rtd)

    def parse_football(self, rtd):
        return self._parse_for("football", rtd)
