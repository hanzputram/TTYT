#!/bin/bash

# TrimTube CLI for Linux/macOS
COMMAND=$1

if [ "$COMMAND" == "run" ]; then
    echo "Starting TrimTube Clone..."
    (cd backend && source venv/bin/activate && python main.py) &
    (cd frontend && npm run dev) &
    wait
elif [ "$COMMAND" == "setup" ]; then
    echo "Setting up TrimTube Clone..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ../frontend
    npm install
    echo "Setup Complete!"
else
    echo "Usage: ./ttyt.sh [run|setup]"
fi
