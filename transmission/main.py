import socket, threading, sys
from flask import Flask, jsonify

# TCP server details
SERVER_IP = '10.93.42.234'  # Replace with the server's IP address
SERVER_PORT = 1234           # Port number the server is listening on
app = Flask(__name__)
PRODUCTION = True
rtd_data = None
rtd_lock = threading.Lock()


def main(ip, port):
    # Create a TCP socket
    global rtd_data
    try:
        while True:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as tcp_socket:
                try:
                    # Connect to the server
                    print(f"Connecting to {ip}:{port}...")
                    tcp_socket.connect((ip, port))
                    print("Connected to the server!")

                    # Continuously receive data from the server
                    while True:
                        rtd = b''
                        c = b''
                        s = ""
                        while b'\x01' not in c:
                            c = tcp_socket.recv(1024)
                            # print(c)
                        rtd += c[c.index(b'\x01')+1:]
                        c = tcp_socket.recv(1024)
                        # print('start', rtd)
                        while b'\x04' not in c:
                            # print(c)
                            rtd += c
                            # print(rtd)
                            c = tcp_socket.recv(1024)
                        rtd += c
                        rtd = rtd[:rtd.index(b'\x04')]
                        # print(rtd)
                    
                        rtd = rtd.decode()
                        # print(rtd)
                        # print(rtd)

                        main_clock = rtd[0:5].strip() 
                        main_clock = main_clock if main_clock != "" else '0:00'
                        
                        # play_clock = rtd[8:10].strip()
                        # play_clock = play_clock if play_clock != "" else '35'

                        home_score = rtd[12:15].strip()
                        home_score = home_score if home_score != "" else "0"

                        away_score = rtd[15:18].strip()
                        away_score = away_score if away_score != "" else "0"

                        home_fouls = rtd[18:20].strip()
                        home_fouls = home_fouls if home_fouls != "" else "0"

                        away_fouls = rtd[20:22].strip()
                        away_fouls = away_fouls if away_fouls != "" else "0"

                        home_time_outs = rtd[24].strip()
                        home_time_outs = home_time_outs if home_time_outs != "" else "5"

                        away_time_outs = rtd[27].strip()
                        away_time_outs = away_time_outs if away_time_outs != "" else "5"

                        period = rtd[28].strip()
                        period = period if period != "" else "0"

                        resp = {
                            'main_clock': main_clock,
                            'home_score' : home_score,
                            'away_score' : away_score,
                            'home_fouls' : home_fouls,
                            "away_fouls" : away_fouls,
                            "home_time_outs": home_time_outs,
                            "away_time_outs" : away_time_outs,
                            "period" :period
                        }

                        rtd_data = resp

                except ConnectionRefusedError:
                    print(f"Failed to connect to {ip}:{port}. Is the server running?")
                except KeyboardInterrupt:
                    print("\nConnection closed by the client.")
    except KeyboardInterrupt:
                print("\nStopped loop by the client.")



@app.route('/', methods=['GET'])
def scoreboard():
    with rtd_lock:
        # print(rtd_data)
        return jsonify(rtd_data)

@app.route('/view-b', methods=['GET'])
def view_b():
    with open("./static/scoreboard-b.html", "r") as f:
        return f.read()

@app.route('/view-tod', methods=['GET'])
def view_tod():
    with open("./static/scoreboardTOD.html", "r") as f:
        return f.read()
    
@app.route('/view-minb', methods=['GET'])
def view_minb():
    with open("./static/minScoreboardBasketball.html", "r") as f:
        return f.read()
    


if __name__ == "__main__":

    client_thread = threading.Thread(
        target=main, args=(SERVER_IP, SERVER_PORT))
    client_thread.start()

    try:
        app.run(port=9001, debug=False)
    except KeyboardInterrupt:
        print("Stopping!")
        client_thread.join()
        sys.exit(0)