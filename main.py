from __future__ import annotations

import logging

from flask import Flask, render_template

from routes import register_route_blueprints
from services.service_service import get_backend_config


def create_app() -> Flask:
    config = get_backend_config()

    logging.basicConfig(
        level=getattr(logging, config.log_level.upper(), logging.INFO),
        format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
    )

    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = config.max_svg_upload_bytes

    register_route_blueprints(app)

    @app.route("/", methods=["GET"])
    def index():
        return render_template("index.html")

    @app.route("/viewer", methods=["GET"])
    def viewer():
        return render_template("viewer.html")

    return app


app = create_app()

if __name__ == "__main__":
    app.run(port=5001)
