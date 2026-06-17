#!/usr/bin/env bash
# .claude/hooks/commit-msg-hotfix-audit.sh
# Git commit-msg hook: detects [skip-tdd] and appends to HOTFIX_LOG.md.

MSG_FILE="$1"
if [[ -z "$MSG_FILE" ]] || [[ ! -f "$MSG_FILE" ]]; then
  exit 0
fi

if ! head -1 "$MSG_FILE" | grep -qiE '^\[skip-tdd\]'; then
  exit 0
fi

AUTHOR="$(git config user.name)"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
FILES="$(git diff --cached --name-only | sed 's/^/  - /')"
RATIONALE_LINE="$(grep -iE '^Rationale:' "$MSG_FILE" | head -1 || true)"
if [[ -z "$RATIONALE_LINE" ]]; then
  RATIONALE="MISSING — author did not provide Rationale: line"
else
  RATIONALE="$(printf '%s' "$RATIONALE_LINE" | sed 's/^[Rr]ationale:[[:space:]]*//')"
fi

LOG_PATH="${HOTFIX_LOG_PATH:-HOTFIX_LOG.md}"
mkdir -p "$(dirname "$LOG_PATH")"
touch "$LOG_PATH"
cat >> "$LOG_PATH" <<EOF

## ${TIMESTAMP} — [skip-tdd]
**Author:** ${AUTHOR}
**Files:**
${FILES}
**Rationale:** ${RATIONALE}

EOF

# Auto-stage the log so the entry is part of the same commit.
# Only stage when using the default repo path — tests override HOTFIX_LOG_PATH
# to a tmpdir and must not touch the working tree.
if [[ -z "${HOTFIX_LOG_PATH:-}" ]]; then
  git add HOTFIX_LOG.md
fi

exit 0
