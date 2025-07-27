#!/bin/bash

# Change to the script's directory (optional but good if running from anywhere)
cd "$(dirname "$0")"

# Activate virtual environment
source .venv/bin/activate

open -na "Google Chrome" "http://127.0.0.1:5000/"

# Run your Python script
python main.py

# Keep the terminal open (optional)
exec $SHELL

