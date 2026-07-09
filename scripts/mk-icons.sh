#!/bin/sh
# Regenerates the PWA icon set in public/icons/ from brand/logo-source.png
# (macOS: uses the built-in `sips`). The logo is full-bleed, so the maskable
# variant is the same render at 512.
set -e
cd "$(dirname "$0")/.."
sips -z 512 512 brand/logo-source.png --out public/icons/icon-512.png
sips -z 512 512 brand/logo-source.png --out public/icons/icon-maskable-512.png
sips -z 192 192 brand/logo-source.png --out public/icons/icon-192.png
sips -z 180 180 brand/logo-source.png --out public/icons/apple-touch-icon.png
echo "icons regenerated"
