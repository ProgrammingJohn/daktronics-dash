from flask import Flask, render_template
import os, sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from routes import register_route_blueprints

app = Flask(__name__)

# Register blueprints
register_route_blueprints(app)

@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")

@app.route("/viewer", methods=["GET"])
def viewer():
    return render_template("viewer.html")

if __name__ == "__main__":
    app.run()
