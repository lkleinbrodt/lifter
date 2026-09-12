#!/bin/bash
# Push a JS/asset-only OTA update to the installed ad-hoc build (no App Store involved).
set -e
cd "$(dirname "$0")/.."
MESSAGE="${1:-"OTA update"}"
eas update --branch preview --platform ios --non-interactive --clear-cache --message "$MESSAGE"
