#!/bin/bash

set -e # Exit on error

# Configuration
APP_NAME="TAK Manager"
DMG_NAME="TAKManager-Installer"
VOLUME_NAME="TAK Manager Installer"

# Store the original directory
ORIGINAL_DIR="$PWD"

# Clean up any existing DMG files
rm -f "$ORIGINAL_DIR/$DMG_NAME.dmg"
rm -f "$ORIGINAL_DIR/rw.*.dmg"

# Create a temporary working directory
WORK_DIR="$(mktemp -d)"
cd "$WORK_DIR"

# Function to clean up
cleanup() {
    echo "Cleaning up..."
    cd "$ORIGINAL_DIR"
    rm -rf "$WORK_DIR"
    killall Finder || true
    sleep 2
}

# Set up cleanup on exit
trap cleanup EXIT

# Create a directory for the DMG contents
mkdir "dmg_contents"
cd "dmg_contents"

# Copy the app bundle
cp -r "$ORIGINAL_DIR/TAKManager.app" .

# Create Resources directory and copy SVG
mkdir -p "TAKManager.app/Contents/Resources"
cp "$ORIGINAL_DIR/../../client/public/tak.svg" "TAKManager.app/Contents/Resources/"

cd ..

# Create the DMG using create-dmg
echo "Creating DMG..."
create-dmg \
    --volname "$VOLUME_NAME" \
    --volicon "$ORIGINAL_DIR/TAKManager.app/Contents/Resources/tak.icns" \
    --window-pos 200 120 \
    --window-size 540 380 \
    --icon-size 100 \
    --icon "TAKManager.app" 128 190 \
    --app-drop-link 412 190 \
    --hide-extension "TAKManager.app" \
    --no-internet-enable \
    "$ORIGINAL_DIR/$DMG_NAME.dmg" \
    "dmg_contents/"

echo "DMG installer created successfully: $DMG_NAME.dmg" 