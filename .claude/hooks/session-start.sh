#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code on the web environment
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR/vilo-app"

# Install dependencies (idempotent, uses cache after first install)
npm install

# Verify build works
npm run build

echo "✅ Session start hook: dependencies installed, build verified"
