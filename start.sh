#!/bin/bash

# Check if we're in development mode
if [ "$MODE" = "development" ]; then
    echo "Starting in development mode..."
    # Start React development server in background
    cd /app/client && npm run start &
    # Start Flask development server
    cd /app/server && python app.py
else
    echo "Starting in production mode..."
    # Build frontend
    cd /app/client && npm run build
    # Start Flask server
    cd /app/server && python app.py
fi 