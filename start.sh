#!/bin/bash

# Print environment information for debugging
echo "Current PATH: $PATH"
echo "Current directory: $(pwd)"

# Check if we're in development mode
if [ "$MODE" = "development" ]; then
    echo "Starting in development mode..."
    # Start React development server in background
    cd /app/client && npm run start &
    # Start Flask development server using Poetry
    cd /app/server && echo "Entering server directory: $(pwd)" && poetry run python app.py
else
    echo "Starting in production mode..."
    # Build frontend
    cd /app/client && npm run build
    # Start Flask server using Poetry
    cd /app/server && echo "Entering server directory: $(pwd)" && poetry run python app.py
fi