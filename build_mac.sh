#!/bin/bash

# Exit on error
set -e

echo "🧹 Cleaning previous builds..."
rm -rf build dist

echo "📦 Creating virtual environment..."
python -m venv build_venv
source build_venv/bin/activate

echo "⬇️ Installing requirements..."
pip install --upgrade pip
pip install -r requirements.txt
pip install py2app

echo "🎨 Building Tailwind CSS..."
npm run build:css

echo "🏗️ Building application..."
python setup.py py2app

echo "🔍 Checking for missing dependencies..."
otool -L "dist/System Monitor.app/Contents/MacOS/System Monitor"

echo "📝 Creating .env file in app bundle..."
cp .env "dist/System Monitor.app/Contents/Resources/.env"

echo "🔒 Setting permissions..."
chmod -R 755 "dist/System Monitor.app"

echo "✨ Creating DMG..."
create-dmg \
  --volname "System Monitor" \
  --volicon "frontend/static/img/app_icon.icns" \
  --window-pos 200 120 \
  --window-size 600 300 \
  --icon-size 100 \
  --icon "System Monitor.app" 175 120 \
  --hide-extension "System Monitor.app" \
  --app-drop-link 425 120 \
  "dist/System Monitor.dmg" \
  "dist/System Monitor.app"

echo "🎉 Build complete!"
deactivate 