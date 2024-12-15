#!/bin/bash

# Set Python to show full error messages
export PYTHONUNBUFFERED=1
export FLASK_DEBUG=1
export FLASK_ENV=development
export PYTHONDONTWRITEBYTECODE=1
export PYTHONPATH="$PYTHONPATH:$(pwd)"

# Check if the app exists
if [ ! -f "./dist/Tak Manager.app/Contents/MacOS/Tak Manager" ]; then
    echo "Error: Application not found. Please run build_macos.sh first."
    exit 1
fi

echo "Running packaged app in debug mode..."
echo "Log output will appear below. Press Ctrl+C to stop."
echo "----------------------------------------"

# Run the app with error output redirected to terminal
"./dist/Tak Manager.app/Contents/MacOS/Tak Manager" 2>&1