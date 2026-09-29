#!/usr/bin/env bash
# Work around prompts@2.4.2: ConfirmPrompt._() calls c.toLowerCase() without checking c.
# Expo CLI shows this prompt when the iPhone is locked during install; unlocking can
# emit a keypress with an undefined character and crash the release script.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIRM_FILE="$PROJECT_ROOT/node_modules/prompts/lib/elements/confirm.js"

if [[ ! -f "$CONFIRM_FILE" ]]; then
  exit 0
fi

if grep -q 'if (!c) return this.bell();' "$CONFIRM_FILE"; then
  exit 0
fi

node -e "
const fs = require('fs');
const file = process.argv[1];
let source = fs.readFileSync(file, 'utf8');
const needle = '  _(c, key) {';
const patch = '  _(c, key) {\\n    if (!c) return this.bell();';
if (!source.includes(needle) || source.includes('if (!c) return this.bell();')) {
  process.exit(0);
}
source = source.replace(needle, patch);
fs.writeFileSync(file, source);
" "$CONFIRM_FILE"
