#!/usr/bin/env bash
# Push a JS/asset-only OTA update to the Release build installed on the phone.
# The build listens on the `preview` channel (updates.requestHeaders in app.json).
set -euo pipefail
cd "$(dirname "$0")/.."

OTA_CHANNEL="preview"

MESSAGE="${1:-}"
if [ -z "$MESSAGE" ]; then
  read -r -p "OTA update message: " MESSAGE
  if [ -z "$MESSAGE" ]; then
    echo "Aborted: message is required."
    exit 1
  fi
fi

echo ""
echo "Publishing OTA to channel '$OTA_CHANNEL'..."
echo "Message: $MESSAGE"
echo ""

eas update --channel "$OTA_CHANNEL" --environment preview --platform ios \
  --non-interactive --clear-cache --message "$MESSAGE"

echo ""
echo "Done. Force-quit and reopen Lifter on your phone to fetch the update"
echo "(it downloads on one launch and applies on the next)."
