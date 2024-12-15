#!/bin/bash

# Ensure we're in the virtual environment
if [ -z "$VIRTUAL_ENV" ]; then
    echo "Please activate your virtual environment first with: source .venv/bin/activate"
    exit 1
fi

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf build dist
find . -type d -name "__pycache__" -exec rm -r {} +

# Install/update dependencies
echo "Installing/updating dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Build frontend
echo "Building frontend..."
npm install
npm run build

# Verify frontend build and move it to the correct location if needed
if [ ! -d "dist" ]; then
    if [ -d "src/dist" ]; then
        echo "Moving frontend build from src/dist to dist..."
        mv src/dist dist
    else
        echo "Frontend build failed! dist directory not found."
        exit 1
    fi
fi

# Build macOS app using PyInstaller
echo "Building macOS app..."
pyinstaller --clean tak_manager.spec

# Verify the build
if [ -d "dist/Tak Manager.app" ]; then
    echo "Build completed successfully!"
    echo "Application is available at: dist/Tak Manager.app"
else
    echo "Build failed! Application bundle not found."
    exit 1
fi 