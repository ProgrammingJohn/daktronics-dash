import os, sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from flask import Blueprint, render_template, request, jsonify
from services.service_service import scoreboards, load_scoreboard, update_scoreboard_preferences, scoreboard_modes
from services.utils import get_scoreboard_preferences
from services.service_service import active_thread, ScoreboardService

api_bp = Blueprint('api', __name__)

@api_bp.route("/api/scoreboard-svg", methods=["GET"])
def get_scoreboard_svg():
    scoreboard_name = request.args.get('Scoreboard')
    if not scoreboard_name:
        return jsonify({'message': 'Scoreboard name is required', 'data': None}), 400
    scoreboard_data = load_scoreboard(scoreboard_name.lower())
    if not scoreboard_data:
        return jsonify({'message': 'Scoreboard does not exist', 'data': None}), 404
    return jsonify({'message': None, 'data': scoreboard_data}), 200

@api_bp.route("/api/scoreboard-names", methods=["GET"])
def get_scoreboard_names():
    return jsonify({'message': None, 'data': {'names' : scoreboards, 'modes': scoreboard_modes}}), 200

@api_bp.route("/api/scoreboard-preferences", methods=["GET"])
def api_get_scoreboard_preferences():
    scoreboard_name = request.args.get('Scoreboard')
    if not scoreboard_name:
        return jsonify({'message': 'Scoreboard name is required', 'data': None}), 400
    scoreboard_data = get_scoreboard_preferences()[scoreboard_name.lower()]
    if not scoreboard_data:
        return jsonify({'message': 'Scoreboard does not exist', 'data': None}), 404
    return jsonify({'message': None, 'data': scoreboard_data}), 200

@api_bp.route("/api/scoreboard-update", methods=["POST"])
def update_scoreboard():
    data = request.get_json()
    preferences = data.get('preferences')
    scoreboard_name = data.get('scoreboard')
    if not preferences:
        return jsonify({'message': 'Preferences are required', 'data': None}), 400
    if not scoreboard_name:
        return jsonify({'message': 'Scoreboard name is required', 'data': None}), 400
    
    update_scoreboard_preferences(preferences, scoreboard_name)
    return jsonify({"message": None}), 200

@api_bp.route("/api/scoreboard-service/start", methods=["POST"])
def start_service():
    global active_thread
    # Start the scoreboard service
    data = request.get_json()
    scoreboard_name = data.get('scoreboard')
    method = data.get('method')
    ip = data.get('ip')
    port = data.get('port')
    if not scoreboard_name:
        return jsonify({'message': 'Scoreboard name is required', 'data': None}), 400
    if not method:
        return jsonify({'message': 'Method is required', 'data': None}), 400
    
    if active_thread is not None:
        active_thread.stop()
        if active_thread.is_alive():
            active_thread.join()
        active_thread = None

    active_thread = ScoreboardService(
        scoreboard_name=scoreboard_name, 
        is_dakdash_synced = False if method == 'manual' else True, 
        ip=ip if ip else None, 
        port=port if port else None
    )
    active_thread.start()
    return jsonify({"message": "Started"}), 200

@api_bp.route('/api/scoreboard-service/update-score', methods=['POST'])
def update_score():
    data = request.json
    scoreboard_data = data.get('score')
    
    if not scoreboard_data:
        return jsonify({"error": "Missing scoreboard_data"}), 400
    
    if not active_thread.is_dakdash_synced:
        active_thread.update_scoreboard_data(scoreboard_data)
        return jsonify({"message": "Score updated manually"})
    
    return jsonify({"error": "Live sync is enabled, cannot update manually"}), 403

@api_bp.route('/api/scoreboard-service/get-score', methods=['GET'])
def get_score():
    global active_thread
    if active_thread is None or not active_thread.running:
        return jsonify({"error": "Scoreboard service is not running"}), 403
    data = active_thread.get_scoreboard_data()
    return jsonify(data)

@api_bp.route('/api/scoreboard-service/get-scoreboard-name', methods=['GET'])
def get_scoreboard_name():
    global active_thread
    if active_thread is None or not active_thread.running:
        return jsonify({"error": "Scoreboard service is not running"}), 403
    data = {"scoreboard_name": active_thread.scoreboard_name}
    return jsonify(data)


@api_bp.route('/api/scoreboard-service/status', methods=['GET'])
def get_status():
    global active_thread
    if active_thread is None:
        return jsonify({"status": "stopped"})
    return jsonify({"status": active_thread.get_status()})
