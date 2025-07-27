import os, sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from routes.api import api_bp
from flask import Flask

def register_route_blueprints(app: Flask):
    app.register_blueprint(api_bp)