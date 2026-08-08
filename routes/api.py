import os, sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from flask import Blueprint, render_template, request, jsonify
from services.service_service import scoreboards, load_scoreboard, update_scoreboard_preferences, scoreboard_modes
from services.utils import get_scoreboard_preferences
from services.runtime import runtime

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
    data = request.get_json(silent=True) or {}
    scoreboard_name = data.get('scoreboard')
    method = data.get('method')
    ip = data.get('ip')
    port = data.get('port')
    if not scoreboard_name:
        return jsonify({'message': 'Scoreboard name is required', 'data': None}), 400
    if not method:
        return jsonify({'message': 'Method is required', 'data': None}), 400
    if method == 'manual':
        runtime.start_manual(scoreboard_name)
    elif method == 'synced':
        device_id = data.get('device_id')
        if not ip:
            return jsonify({'error': 'IP address is required'}), 400
        try:
            port = int(port)
        except (TypeError, ValueError):
            return jsonify({'error': 'Valid port is required'}), 400
        if not 1 <= port <= 65535:
            return jsonify({'error': 'Valid port is required'}), 400
        if not device_id:
            return jsonify({'error': 'Device ID is required'}), 400
        if not runtime.start_synced(scoreboard_name, ip, port, device_id):
            return jsonify({'error': 'Previous scoreboard service did not stop'}), 503
    else:
        return jsonify({'error': 'Unsupported method'}), 400
    return jsonify({"message": "Started"}), 200

@api_bp.route('/api/scoreboard-service/update-score', methods=['POST'])
def update_score():
    data = request.get_json(silent=True) or {}
    scoreboard_data = data.get('score')
    
    if not scoreboard_data:
        return jsonify({"error": "Missing scoreboard_data"}), 400
    
    if not runtime.is_running():
        return jsonify({"error": "Scoreboard service is not running"}), 409
    if runtime.is_manual():
        runtime.update_manual(scoreboard_data)
        return jsonify({"message": "Score updated manually"})
    
    return jsonify({"error": "Live sync is enabled, cannot update manually"}), 403

@api_bp.route('/api/scoreboard-service/get-score', methods=['GET'])
def get_score():
    data = runtime.score()
    if data is None:
        return jsonify({"error": "Scoreboard service is not running"}), 409
    return jsonify(data)

@api_bp.route('/api/scoreboard-service/get-scoreboard-name', methods=['GET'])
def get_scoreboard_name():
    scoreboard_name = runtime.scoreboard_name()
    if scoreboard_name is None:
        return jsonify({"error": "Scoreboard service is not running"}), 409
    data = {"scoreboard_name": scoreboard_name}
    return jsonify(data)


@api_bp.route('/api/scoreboard-service/status', methods=['GET'])
def get_status():
    return jsonify(runtime.status())
