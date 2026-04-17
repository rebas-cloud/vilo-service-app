#!/bin/bash
# Pre-commit hook: Runs eslint before `git commit` commands.
# Claude Code sends tool input as JSON on stdin.
# We filter for git commit commands and block if lint fails.

set -euo pipefail

# Read JSON input from stdin
INPUT=$(cat)

# Extract the command string (via jq or grep fallback)
if command -v jq >/dev/null 2>&1; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
else
  COMMAND=$(echo "$INPUT" | grep -oP '"command"\s*:\s*"\K[^"]*' | head -1)
fi

# Only act on `git commit` commands (not git log, git status, etc.)
if ! echo "$COMMAND" | grep -qE '(^|[^a-zA-Z])git\s+commit\b'; then
  exit 0
fi

# Skip if running inside vilo-app/ (where lint belongs)
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)/vilo-app" 2>/dev/null || exit 0

# Check node_modules exists (skip if not — lint would fail for install reasons)
if [ ! -d node_modules ]; then
  echo "⚠️  pre-commit: node_modules missing — skipping lint check" >&2
  exit 0
fi

echo "🔍 Running linter before commit..." >&2
if ! npm run lint >&2; then
  echo "" >&2
  echo "❌ Linter failed. Fix errors above before committing." >&2
  echo "💡 Run 'npm run lint' locally to see all issues." >&2
  exit 2
fi

echo "✅ Linter passed!" >&2
exit 0
