#!/usr/bin/env bash
# Build a Release (JS embedded, no Metro needed) and install it on the iPhone over USB/Wi-Fi.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

echo ""
echo "Building Release iOS (OTA channel: preview)..."
echo "Connect your iPhone via USB. Pick your device if prompted."
echo ""
echo "Unlock your iPhone and keep the screen on before the install step finishes."
echo "(If the phone is locked, Expo will prompt to unlock — press Enter after unlocking.)"
echo ""

bash "$SCRIPT_DIR/patch-prompts-confirm.sh"

npx expo run:ios --device --configuration Release

echo ""
echo "Installed. JS-only changes next time: npm run update:ota -- \"what changed\""
