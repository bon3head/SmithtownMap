#!/usr/bin/env bash
# .claude/hooks/protect-facts.sh
# Adapted from github.com/tthew/keel block-secret-access.sh
# Tier 5 protection: blocks writes to .facts and .facts.staging via any tool.
# Fail-secure: on parse error, exit 2 with descriptive message.
#
# Platform notes:
# - Requires `jq`. On *nix systems jq is expected on PATH (apt install jq).
# - On Windows the repo vendors a portable jq at tools/jq.exe; if PATH lookup
#   fails we resolve relative to this script's location (../../tools/jq.exe).

set -u

# Resolve jq: prefer PATH, fall back to repo-vendored tools/jq.exe.
if command -v jq >/dev/null 2>&1; then
  JQ="jq"
else
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  VENDORED="$SCRIPT_DIR/../../tools/jq.exe"
  if [[ -x "$VENDORED" ]]; then
    JQ="$VENDORED"
  else
    echo "protect-facts.sh: jq not found on PATH and tools/jq.exe missing" >&2
    exit 2
  fi
fi

INPUT="$(cat)"
TOOL_NAME="$(printf '%s' "$INPUT" | "$JQ" -r '.tool_name // empty')"

emit_deny() {
  local reason="$1"
  "$JQ" -nc --arg r "$reason" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $r
    }
  }'
  exit 0
}

# Resolve symlinks; protected paths
PROTECTED_RE='\.(facts|facts\.staging)$'

matches() {
  printf '%s' "$1" | grep -Eq "$2"
}

# Tool dispatch
case "$TOOL_NAME" in
  Write|Edit|MultiEdit)
    FILE_PATH="$(printf '%s' "$INPUT" | "$JQ" -r '.tool_input.file_path // empty')"
    RESOLVED="$(readlink -f "$FILE_PATH" 2>/dev/null || printf '%s' "$FILE_PATH")"
    if matches "$RESOLVED" "$PROTECTED_RE"; then
      emit_deny "Tier 5: direct writes to .facts/.facts.staging are blocked. Use bun run facts:stage / facts:promote / facts:demote instead. See CLAUDE.md §5."
    fi
    ;;
  NotebookEdit)
    NOTEBOOK_PATH="$(printf '%s' "$INPUT" | "$JQ" -r '.tool_input.notebook_path // empty')"
    RESOLVED="$(readlink -f "$NOTEBOOK_PATH" 2>/dev/null || printf '%s' "$NOTEBOOK_PATH")"
    if matches "$RESOLVED" "$PROTECTED_RE"; then
      emit_deny "Tier 5: notebook writes to .facts/.facts.staging are blocked."
    fi
    ;;
  Bash)
    CMD="$(printf '%s' "$INPUT" | "$JQ" -r '.tool_input.command // empty')"

    # Normalize: strip wrappers (up to 3 rounds)
    NORM="$CMD"
    for _ in 1 2 3; do
      NORM="$(printf '%s' "$NORM" | sed -E 's/^[[:space:]]*(sudo|env[[:space:]]+[A-Za-z_]+=[^[:space:]]+|eval|builtin|command|exec)[[:space:]]+//')"
      NORM="$(printf '%s' "$NORM" | sed -E 's/^[[:space:]]*(bash|sh)[[:space:]]+-c[[:space:]]+["'\'']?//')"
    done

    # Universal redirect catch
    if matches "$NORM" ">+[[:space:]]*[\"\']?[^[:space:]\"\']*\.(facts|facts\.staging)([[:space:]]|$|[\"\'])"; then
      emit_deny "Tier 5: redirect to .facts/.facts.staging detected in Bash command. Use bun run facts:stage instead."
    fi

    # sed -i / --in-place against protected
    # Note: \b is not supported in bash ERE; use ($|[^a-zA-Z0-9_]) for POSIX-portable word boundary.
    if matches "$NORM" "sed[[:space:]]+(-[a-zA-Z]*[iI]|--in-place)" && matches "$NORM" "\.(facts|facts\.staging)($|[^a-zA-Z0-9_])"; then
      emit_deny "Tier 5: sed -i targeting .facts/.facts.staging detected. Use the staging scripts."
    fi

    # tee / mutation verbs against protected
    if matches "$NORM" "(^|[[:space:]]|[\`\$\(\)\;\&\|]+[[:space:]]*)(tee|echo|awk|cp|mv|dd|python|python3|node|perl)[[:space:]]" && matches "$NORM" "\.(facts|facts\.staging)($|[^a-zA-Z0-9_])"; then
      emit_deny "Tier 5: mutation verb against .facts/.facts.staging detected. Use the staging scripts."
    fi

    # git mutations targeting protected paths
    if matches "$NORM" "git[[:space:]]+(mv|checkout|restore|switch)[[:space:]].*\.(facts|facts\.staging)"; then
      emit_deny "Tier 5: git mv/checkout/restore/switch against .facts/.facts.staging blocked. Use the staging scripts."
    fi

    # git bypass flags
    if matches "$NORM" "git[[:space:]]+(commit|push)[[:space:]].*--no-verify"; then
      emit_deny "Tier 5: git --no-verify blocked. Hooks exist for a reason; if this is an emergency, use the [skip-tdd] commit-message marker which is audited."
    fi
    ;;
esac

exit 0
