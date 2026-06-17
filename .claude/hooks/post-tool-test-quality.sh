#!/usr/bin/env bash
# .claude/hooks/post-tool-test-quality.sh
# After any write to a test file, run Bun-test-aware test-quality lint.

# Resolve jq: prefer PATH, fall back to repo-vendored tools/jq.exe.
if command -v jq >/dev/null 2>&1; then
  JQ="jq"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  VENDORED="$SCRIPT_DIR/../../tools/jq.exe"
  if [[ -x "$VENDORED" ]]; then
    JQ="$VENDORED"
  else
    echo "post-tool-test-quality.sh: jq not found on PATH and tools/jq.exe missing" >&2
    exit 0
  fi
fi

INPUT="$(cat)"
TOOL_NAME="$(printf '%s' "$INPUT" | "$JQ" -r '.tool_name // empty')"

case "$TOOL_NAME" in
  Write|Edit|MultiEdit) FP="$(printf '%s' "$INPUT" | "$JQ" -r '.tool_input.file_path // empty')" ;;
  *) exit 0 ;;
esac

# Only fire on tests/**/*.test.ts
if [[ "$FP" =~ ^tests/.*\.test\.ts$ ]]; then
  if ! bun run test-quality:lint -- "$FP" 2>&1; then
    # Non-blocking warning; final gate is CI test-quality-lint.yml
    echo "WARNING: test-quality lint flagged issues in $FP. Run: bun run test-quality:lint -- $FP" >&2
  fi
fi

exit 0
