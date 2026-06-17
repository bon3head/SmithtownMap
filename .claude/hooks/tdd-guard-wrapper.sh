#!/usr/bin/env bash
# .claude/hooks/tdd-guard-wrapper.sh
# Wraps tdd-guard for our settings.json. Respects [skip-tdd] commit-msg marker.
#
# Platform note: `bunx tdd-guard` shells through Node which on Windows + Node 20
# hits an ERR_REQUIRE_ESM bug (tdd-guard@1.6.8 imports @anthropic-ai/claude-agent-sdk
# as ESM but is required as CJS). We invoke via `bun` (which loads ESM natively)
# pointing at the package's cli entry directly. Equivalent to `bunx tdd-guard` on
# *nix where this bug does not manifest.

# If the most recent commit message starts with [skip-tdd], skip TDD enforcement.
# This is a soft check; the commit-msg hook (audited) is the source of truth.
if git log -1 --format=%B 2>/dev/null | head -1 | grep -qiE '^\[skip-tdd\]'; then
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TDD_GUARD_ENTRY="$REPO_ROOT/node_modules/tdd-guard/dist/cli/tdd-guard.js"

# Delegate to tdd-guard via bun (ESM-safe). Fall back to bunx for non-Windows.
if [[ -f "$TDD_GUARD_ENTRY" ]]; then
  exec bun "$TDD_GUARD_ENTRY" "$@"
else
  exec bunx tdd-guard "$@"
fi
