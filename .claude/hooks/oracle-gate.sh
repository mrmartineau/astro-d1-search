#!/usr/bin/env bash
# Stop hook: before Claude finishes, run the tests (unit + oracles + intent
# checks) if anything under src/ or intent/ changed on this branch, committed
# or not. Exit 2 blocks the stop and feeds the failure back so Claude fixes it
# or revises intent/ deliberately.
set -uo pipefail

input=$(cat)
# Already continuing because of this hook: don't loop forever.
if [[ "$input" =~ \"stop_hook_active\"[[:space:]]*:[[:space:]]*true ]]; then exit 0; fi

# Test where Claude is working (may be a worktree), not where the session began.
cwd=""
if [[ "$input" =~ \"cwd\"[[:space:]]*:[[:space:]]*\"([^\"]*)\" ]]; then cwd="${BASH_REMATCH[1]}"; fi
cd "${cwd:-${CLAUDE_PROJECT_DIR:-.}}" 2>/dev/null || exit 0
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

# Everything this branch changed vs main, plus uncommitted and untracked work.
base=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || echo HEAD)
changed=$( { git diff --name-only "$base"; git ls-files --others --exclude-standard; } 2>/dev/null \
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
