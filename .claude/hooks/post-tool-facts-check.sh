#!/usr/bin/env bash
# .claude/hooks/post-tool-facts-check.sh
# After any write to .facts or .facts.staging, re-run facts:check.

# Resolve jq: prefer PATH, fall back to repo-vendored tools/jq.exe.
if command -v jq >/dev/null 2>&1; then
  JQ="jq"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  VENDORED="$SCRIPT_DIR/../../tools/jq.exe"
  if [[ -x "$VENDORED" ]]; then
    JQ="$VENDORED"
  else
    echo "post-tool-facts-check.sh: jq not found on PATH and tools/jq.exe missing" >&2
    exit 0
  fi
fi

INPUT="$(cat)"
TOOL_NAME="$(printf '%s' "$INPUT" | "$JQ" -r '.tool_name // empty')"

case "$TOOL_NAME" in
  Write|Edit|MultiEdit)
    FP="$(printf '%s' "$INPUT" | "$JQ" -r '.tool_input.file_path // empty')"
    ;;
  NotebookEdit)
    FP="$(printf '%s' "$INPUT" | "$JQ" -r '.tool_input.notebook_path // empty')"
    ;;
  *) exit 0 ;;
esac

if [[ "$FP" =~ \.facts$ ]] || [[ "$FP" =~ \.facts\.staging$ ]]; then
  bun run facts:check 2>&1 || true
fi

exit 0
