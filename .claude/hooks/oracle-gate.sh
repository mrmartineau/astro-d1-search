#!/usr/bin/env bash
# Stop hook: before Claude finishes, run the tests (unit + oracles + intent
# checks) if anything under src/ or intent/ changed. Exit 2 blocks the stop and
# feeds the failure back so Claude fixes it or revises intent/ deliberately.
set -uo pipefail

input=$(cat)
# Already continuing because of this hook: don't loop forever.
if [[ "$input" == *'"stop_hook_active":true'* ]]; then exit 0; fi

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}" || exit 0

changed=$( { git diff --name-only HEAD; git ls-files --others --exclude-standard; } 2>/dev/null \
  | grep -E '^(src|intent)/' || true)
[[ -z "$changed" ]] && exit 0

if ! out=$(bun test 2>&1); then
  {
    echo "Tests failed. If an oracle failed, read intent/search.md for the rule (R1-R5)."
    echo "Fix the change, or if the rule should change, edit intent/ first and say why."
    echo
    echo "$out" | tail -60
  } >&2
  exit 2
fi
exit 0
