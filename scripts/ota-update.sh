#!/usr/bin/env bash
# Push a JS/asset-only OTA update to the Release build installed on the phone.
# The build listens on the `preview` channel (updates.requestHeaders in app.json).
# The update bundles the working tree, so this only runs from a clean `main`
# (set OTA_ANY_BRANCH=1 to override).
set -euo pipefail
cd "$(dirname "$0")/.."

OTA_CHANNEL="preview"

# Without a TTY (e.g. chewy), expo-cli's export step needs CI=1.
[ -t 0 ] || export CI=1

if [ "${OTA_ANY_BRANCH:-}" != "1" ]; then
  branch="$(git rev-parse --abbrev-ref HEAD)"
  if [ "$branch" != "main" ] || [ -n "$(git status --porcelain)" ]; then
    echo "Refusing: OTA bundles the working tree. Switch to a clean 'main' (or set OTA_ANY_BRANCH=1)."
    exit 1
  fi
fi

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
