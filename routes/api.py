from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from flask import Blueprint, Response, jsonify, request, send_from_directory

from services.preferences import get_preferences, update_preferences
from services.service_service import (
    get_backend_config,
    get_runtime,
    get_scoreboard_names,
    get_scoreboard_preferences,
    get_svg_service,
    load_scoreboard,
    scoreboard_modes,
    scoreboards,
    update_scoreboard_preferences,
)

api_bp = Blueprint("api", __name__)

_runtime = get_runtime()
_svg = get_svg_service()
_config = get_backend_config()


# -----------------------------
# Shared response helpers
# -----------------------------
def _ok(data: Any = None, message: Optional[str] = None, status_code: int = 200) -> Tuple[Response, int]:
    return jsonify({"message": message, "data": data}), status_code


def _error(message: str, status_code: int = 400, error_code: str = "bad_request") -> Tuple[Response, int]:
    return (
        jsonify(
            {
                "message": message,
                "data": None,
                "error_code": error_code,
            }
        ),
        status_code,
    )


def _request_json() -> Dict[str, Any]:
    return request.get_json(silent=True) or {}


# -----------------------------
# New API surface
# -----------------------------
@api_bp.route("/api/health", methods=["GET"])
def health() -> Tuple[Response, int]:
    return _ok(_runtime.health())


@api_bp.route("/api/session/start", methods=["POST"])
def start_session() -> Tuple[Response, int]:
    data = _request_json()
    sport = (data.get("sport") or "").strip().lower()
    control_mode = (data.get("control_mode") or "manual").strip().lower()
    esp_ip = data.get("esp_ip")
    esp_port = data.get("esp_port")

    try:
        if control_mode == "live":
            if esp_port is None:
                return _error("esp_port is required in live mode", 400, "missing_field")
            session = _runtime.start_session(
                sport=sport,
                control_mode=control_mode,
                esp_ip=str(esp_ip).strip() if esp_ip else None,
                esp_port=int(esp_port),
            )
        else:
            session = _runtime.start_session(sport=sport, control_mode=control_mode)
    except ValueError as exc:
        return _error(str(exc), 400, "invalid_request")

    return _ok(session)


@api_bp.route("/api/session/stop", methods=["POST"])
def stop_session() -> Tuple[Response, int]:
    _runtime.stop_session()
    return _ok({"status": "stopped"})


@api_bp.route("/api/state", methods=["GET"])
def get_state() -> Tuple[Response, int]:
    return _ok(_runtime.get_state())


@api_bp.route("/api/control-mode", methods=["PUT"])
def set_control_mode() -> Tuple[Response, int]:
    data = _request_json()
    mode = (data.get("control_mode") or "").strip().lower()

    try:
        state = _runtime.set_control_mode(mode)
    except ValueError as exc:
        return _error(str(exc), 400, "invalid_request")

    return _ok(state)


@api_bp.route("/api/manual-update", methods=["POST"])
def manual_update() -> Tuple[Response, int]:
    data = _request_json()
    payload = data.get("score") if isinstance(data.get("score"), dict) else data

    if not isinstance(payload, dict) or not payload:
        return _error("score payload is required", 400, "missing_field")

    try:
        state = _runtime.apply_manual_update(payload)
    except RuntimeError as exc:
        if str(exc) == "manual_updates_disabled":
            return _error("live mode is enabled; manual updates are blocked", 409, "mode_conflict")
        return _error("manual update failed", 500, "manual_update_failed")
    except ValueError as exc:
        return _error(str(exc), 400, "invalid_request")

    return _ok(state)


@api_bp.route("/api/connection", methods=["GET"])
def connection_status() -> Tuple[Response, int]:
    return _ok(_runtime.get_connection())


@api_bp.route("/api/templates", methods=["GET"])
def list_templates() -> Tuple[Response, int]:
    return _ok({"templates": _svg.list_templates()})


@api_bp.route("/api/templates/<template_name>", methods=["GET"])
def get_template(template_name: str) -> Tuple[Response, int]:
    template = _svg.load_template(template_name)
    if template is None:
        return _error("template not found", 404, "not_found")
    return _ok({"name": template_name, "svg": template})


@api_bp.route("/api/templates/upload", methods=["POST"])
def upload_template() -> Tuple[Response, int]:
    upload = request.files.get("file")
    if upload is None:
        return _error("file is required", 400, "missing_file")

    try:
        filename = _svg.save_upload(upload)
    except ValueError as exc:
        return _error(str(exc), 400, "invalid_file")

    return _ok({"filename": filename}, status_code=201)


@api_bp.route("/api/templates/<template_name>/download", methods=["GET"])
def download_template(template_name: str):
    path = _svg.get_template_path(template_name)
    if not path.exists():
        return _error("template not found", 404, "not_found")

    return send_from_directory(
        _config.svg_path,
        path.name,
        as_attachment=True,
        download_name=path.name,
        mimetype="image/svg+xml",
    )


@api_bp.route("/api/templates/render", methods=["POST"])
def render_template() -> Tuple[Response, int]:
    data = _request_json()
    template_name = data.get("template") or data.get("scoreboard")
    values = data.get("values") or data.get("state") or {}
    css_vars = data.get("css_vars") or data.get("preferences") or {}

    if not template_name:
        return _error("template name is required", 400, "missing_field")
    if not isinstance(values, dict):
        return _error("values must be an object", 400, "invalid_request")
    if not isinstance(css_vars, dict):
        return _error("css_vars must be an object", 400, "invalid_request")

    try:
        rendered = _svg.render(str(template_name), values=values, css_vars=css_vars)
    except FileNotFoundError:
        return _error("template not found", 404, "not_found")

    return _ok({"svg": rendered})


@api_bp.route("/api/preferences/<sport>", methods=["GET"])
def api_get_preferences(sport: str) -> Tuple[Response, int]:
    prefs = get_preferences(_config, sport)
    if prefs is None:
        return _error("sport not found", 404, "not_found")
    return _ok(prefs)


@api_bp.route("/api/preferences/<sport>", methods=["PUT"])
def api_put_preferences(sport: str) -> Tuple[Response, int]:
    data = _request_json()
    if not isinstance(data, dict):
        return _error("preferences payload must be an object", 400, "invalid_request")

    updated = update_preferences(_config, sport, data)
    return _ok(updated)


# -----------------------------
# Legacy compatibility endpoints
# -----------------------------
@api_bp.route("/api/scoreboard-svg", methods=["GET"])
def get_scoreboard_svg() -> Tuple[Response, int]:
    scoreboard_name = request.args.get("Scoreboard")
    if not scoreboard_name:
        return _error("Scoreboard name is required", 400, "missing_field")

    scoreboard_data = load_scoreboard(scoreboard_name.lower())
    if not scoreboard_data:
        return _error("Scoreboard does not exist", 404, "not_found")

    return _ok(scoreboard_data)


@api_bp.route("/api/scoreboard-names", methods=["GET"])
def get_scoreboard_names_legacy() -> Tuple[Response, int]:
    data = {
        "names": get_scoreboard_names() or scoreboards,
        "modes": scoreboard_modes,
    }
    return _ok(data)


@api_bp.route("/api/scoreboard-preferences", methods=["GET"])
def api_get_scoreboard_preferences() -> Tuple[Response, int]:
    scoreboard_name = request.args.get("Scoreboard")
    if not scoreboard_name:
        return _error("Scoreboard name is required", 400, "missing_field")

    scoreboard_data = get_scoreboard_preferences(scoreboard_name.lower())
    if not scoreboard_data:
        return _error("Scoreboard does not exist", 404, "not_found")

    return _ok(scoreboard_data)


@api_bp.route("/api/scoreboard-update", methods=["POST"])
def update_scoreboard() -> Tuple[Response, int]:
    data = _request_json()
    preferences = data.get("preferences")
    scoreboard_name = data.get("scoreboard")

    if not isinstance(preferences, dict):
        return _error("Preferences are required", 400, "missing_field")
    if not scoreboard_name:
        return _error("Scoreboard name is required", 400, "missing_field")

    update_scoreboard_preferences(preferences, scoreboard_name)
    return _ok()


@api_bp.route("/api/scoreboard-service/start", methods=["POST"])
def start_service_legacy() -> Tuple[Response, int]:
    data = _request_json()
    scoreboard_name = data.get("scoreboard")
    method = data.get("method")
    ip = data.get("ip")
    port = data.get("port")

    if not scoreboard_name:
        return jsonify({"message": "Scoreboard name is required", "data": None}), 400
    if not method:
        return jsonify({"message": "Method is required", "data": None}), 400

    control_mode = "manual" if method == "manual" else "live"
    try:
        if control_mode == "live":
            if not ip or not port:
                return jsonify({"message": "ip and port are required for synced mode", "data": None}), 400
            _runtime.start_session(
                sport=str(scoreboard_name).lower(),
                control_mode="live",
                esp_ip=str(ip),
                esp_port=int(port),
            )
        else:
            _runtime.start_session(sport=str(scoreboard_name).lower(), control_mode="manual")
    except ValueError as exc:
        return jsonify({"message": str(exc), "data": None}), 400

    return jsonify({"message": "Started"}), 200


@api_bp.route("/api/scoreboard-service/update-score", methods=["POST"])
def update_score_legacy():
    data = _request_json()
    scoreboard_data = data.get("score")

    if not isinstance(scoreboard_data, dict):
        return jsonify({"error": "Missing scoreboard_data"}), 400

    try:
        _runtime.apply_manual_update(scoreboard_data)
    except RuntimeError:
        return jsonify({"error": "Live sync is enabled, cannot update manually"}), 403
    except ValueError:
        return jsonify({"error": "Scoreboard service is not running"}), 403

    return jsonify({"message": "Score updated manually"})


@api_bp.route("/api/scoreboard-service/get-score", methods=["GET"])
def get_score_legacy():
    session = _runtime.get_session()
    if not session.get("sport"):
        return jsonify({"error": "Scoreboard service is not running"}), 403
    data = _runtime.get_state()
    return jsonify(data)


@api_bp.route("/api/scoreboard-service/get-scoreboard-name", methods=["GET"])
def get_scoreboard_name_legacy():
    session = _runtime.get_session()
    if not session.get("sport"):
        return jsonify({"error": "Scoreboard service is not running"}), 403
    return jsonify({"scoreboard_name": session["sport"]})


@api_bp.route("/api/scoreboard-service/status", methods=["GET"])
def get_status_legacy():
    session = _runtime.get_session()
    if not session.get("sport"):
        return jsonify({"status": "stopped"})

    status = _runtime.get_connection().get("status")
    return jsonify({"status": status})
