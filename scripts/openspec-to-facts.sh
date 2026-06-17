#!/usr/bin/env bash
# SAFE OpenSpec -> .facts bridge (preview-only; does NOT write any facts file).
#
# Usage: ./scripts/openspec-to-facts.sh <change-name>
#
# This extracts the `bun run facts:stage ...` commands that OpenSpec authored
# (per openspec/config.yaml rules) into a change's tasks.md, and PRINTS them for
# review. It deliberately does NOT write .facts or .facts.staging.
#
# The ONLY sanctioned writer of the staging ledger is `bun run facts:stage`
# (scripts/facts-stage.ts), which validates the @avcodes/facts YAML schema,
# requires an existing --spec back-ref file, and dedupes ids. Appending raw
# lines to .facts.staging (as a prior version of this script did) corrupts the
# ledger — parseStaging() cannot read it — and bypasses the Tier 5 trust model.
#
# After reviewing the printed commands, run them yourself (or let the agent run
# them during /opsx:apply). Then check with: bun run spec:lint
set -euo pipefail

CHANGE="${1:?usage: openspec-to-facts.sh <change-name>}"
TASKS_FILE="openspec/changes/$CHANGE/tasks.md"

if [ ! -f "$TASKS_FILE" ]; then
  echo "ERROR: $TASKS_FILE not found. Run /opsx:propose first." >&2
  exit 1
fi

echo "# facts:stage commands authored by OpenSpec for change '$CHANGE'"
echo "# (review, then run each — they delegate to the validating facts:stage script)"
echo "# This script writes nothing; facts:stage is the only sanctioned writer."
echo

matches="$(grep -nE 'bun run facts:stage' "$TASKS_FILE" || true)"
if [ -z "$matches" ]; then
  echo "# (no 'bun run facts:stage' commands found in tasks.md)"
  echo "# tasks.md must include explicit:"
  echo "#   bun run facts:stage --id <id> --label \"<claim>\" \\"
  echo "#     --command \"bun test tests/ash/<module>/<name>.test.ts\" \\"
  echo "#     --tags \"spec,<cluster>\" --spec openspec/changes/$CHANGE/specs/<x>.md"
  echo "# (see openspec/config.yaml rules.tasks)"
  exit 0
fi

# Strip leading "<line>:- [ ] " checkbox/markdown noise, leaving the command.
echo "$matches" | sed -E 's/^[0-9]+:[[:space:]]*-?[[:space:]]*\[[ xX]?\][[:space:]]*//'
echo
echo "# Reviewed? Run the commands above, then: bun run spec:lint"
