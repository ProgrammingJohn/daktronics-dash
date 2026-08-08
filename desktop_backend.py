from __future__ import annotations

import os
from pathlib import Path
import sys

from flask import Flask, send_from_directory

from routes import register_route_blueprints


HOST = "127.0.0.1"
DEFAULT_PORT = 58321


def resource_root() -> Path:
    packaged_root = getattr(sys, "_MEIPASS", None)
    if packaged_root is not None:
        return Path(packaged_root)
    return Path(__file__).resolve().parent


def server_port() -> int:
    return int(os.environ.get("DAKDASH_PORT", str(DEFAULT_PORT)))


def create_desktop_app(dist_path: Path | None = None) -> Flask:
    resolved_dist_path = (dist_path or resource_root() / "desktop" / "dist").resolve()
    if not (resolved_dist_path / "index.html").is_file():
        raise RuntimeError(f"DakDash operator build is missing: {resolved_dist_path}")
    if not (resolved_dist_path / "viewer.html").is_file():
        raise RuntimeError(f"DakDash viewer build is missing: {resolved_dist_path}")

    app = Flask(
        __name__,
        static_folder=str(resolved_dist_path),
        static_url_path="",
    )
    register_route_blueprints(app)

    @app.get("/")
    def operator_console():
        return send_from_directory(resolved_dist_path, "index.html")

    @app.get("/viewer")
    @app.get("/viewer.html")
    def obs_viewer():
        return send_from_directory(resolved_dist_path, "viewer.html")

    return app


app = create_desktop_app()


if __name__ == "__main__":
    app.run(
        host=HOST,
        port=server_port(),
        debug=False,
        use_reloader=False,
        threaded=True,
    )
