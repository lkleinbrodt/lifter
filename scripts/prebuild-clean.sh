#!/usr/bin/env bash
# Regenerate the (gitignored) ios/ project from app.json + config plugins.
set -euo pipefail
cd "$(dirname "$0")/.."

echo ""
echo "Regenerating native projects (expo prebuild --clean)..."
npx expo prebuild --clean --platform ios

echo ""
echo "Done. Next: npm run release:ios"
