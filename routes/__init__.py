from __future__ import annotations

from flask import Flask

from routes.api import api_bp


def register_route_blueprints(app: Flask) -> None:
    app.register_blueprint(api_bp)
