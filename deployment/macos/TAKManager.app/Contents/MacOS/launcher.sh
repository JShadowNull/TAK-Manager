#!/bin/bash

# Get the app bundle resources directory
RESOURCES_DIR="$(cd "$(dirname "$0")/../Resources" && pwd)"
cd "$RESOURCES_DIR"

# Function to show status
show_status() {
    osascript -e "display notification \"$1\" with title \"TAK Manager\""
}

# Cleanup function
cleanup() {
    echo "Cleaning up..."
    docker compose down
    rm -f manifest.json
}

# Set up cleanup on exit
trap cleanup EXIT INT TERM

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    show_status "Installing Docker Desktop..."
    
    # Download Docker Desktop
    curl -o docker.dmg "https://desktop.docker.com/mac/main/arm64/Docker.dmg"
    
    # Mount Docker DMG
    hdiutil attach docker.dmg
    
    # Install Docker
    cp -R "/Volumes/Docker/Docker.app" /Applications/
    
    # Unmount Docker DMG
    hdiutil detach "/Volumes/Docker"
    
    # Clean up
    rm docker.dmg
    
    # Start Docker
    open -a "Docker"
    
    show_status "Waiting for Docker to start..."
    # Wait for Docker to start
    while ! docker info &>/dev/null; do
        sleep 2
    done
fi

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    show_status "Starting Docker..."
    open -a "Docker"
    while ! docker info >/dev/null 2>&1; do
        sleep 2
    done
fi

# Check if container is running
if ! docker compose ps | grep -q "tak-manager"; then
    show_status "Starting TAK Manager containers..."
    docker compose up -d
fi

# Wait for the service to be ready
show_status "Starting TAK Manager..."
while ! curl -s http://localhost:8989 >/dev/null; do
    sleep 1
done

# Launch Safari
show_status "TAK Manager is ready!"
open -a Safari "http://localhost:8989"

# Wait for Safari to exit
while pgrep -f "Safari.*http://localhost:8989" >/dev/null; do
    sleep 1
done 