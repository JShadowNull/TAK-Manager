#!/bin/bash

# Create temporary iconset directory
ICONSET="tak.iconset"
mkdir -p "$ICONSET"

# Set Inkscape path
INKSCAPE="/Applications/Inkscape.app/Contents/MacOS/inkscape"

# Get absolute path to SVG file
SVG_PATH="$(cd ../.. && pwd)/client/public/tak.svg"

# Convert SVG to PNG at different sizes
for size in 16 32 64 128 256 512 1024; do
  # Normal resolution
  "$INKSCAPE" -w $size -h $size "$SVG_PATH" -o "$ICONSET/icon_${size}x${size}.png"
  
  # High resolution (2x) - except for 1024 which would be too large
  if [ $size != 1024 ]; then
    "$INKSCAPE" -w $((size*2)) -h $((size*2)) "$SVG_PATH" -o "$ICONSET/icon_${size}x${size}@2x.png"
  fi
done

# Rename files to match Apple's iconset requirements
mv "$ICONSET/icon_16x16.png" "$ICONSET/icon_16x16.png"
mv "$ICONSET/icon_32x32.png" "$ICONSET/icon_32x32.png"
mv "$ICONSET/icon_64x64.png" "$ICONSET/icon_32x32@2x.png"
mv "$ICONSET/icon_128x128.png" "$ICONSET/icon_128x128.png"
mv "$ICONSET/icon_256x256.png" "$ICONSET/icon_256x256.png"
mv "$ICONSET/icon_512x512.png" "$ICONSET/icon_512x512.png"
mv "$ICONSET/icon_1024x1024.png" "$ICONSET/icon_512x512@2x.png"

# Create icns file
iconutil -c icns "$ICONSET"

# Move the icns file to Resources
mv tak.icns TAKManager.app/Contents/Resources/

# Clean up
rm -rf "$ICONSET" 