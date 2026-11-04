# Intent

What this package promises, why, and how each promise is checked. Code
implements these; it doesn't define them.

Each file is one area. Each rule has an id, the rule, why, assumptions, and the
check that enforces it. When a check fails, either the change is wrong or the
rule needs revising. Revise the rule here first, deliberately, then the check.

| File                     | Covers                                      | Checked by                               |
| ------------------------ | ------------------------------------------- | ---------------------------------------- |
| [search.md](search.md)   | Matching, filtering, ordering, input safety | `src/search.oracle.test.ts` (real FTS5)  |
| [budgets.md](budgets.md) | Runtime constraints                         | `src/intent.test.ts`, `src/core.test.ts` |
| [decisions/](decisions/) | Why things are the way they are             | Read before changing the area they cover |

## Workflow

1. Start a change by reading the relevant intent file.
2. If the change needs a rule to change, edit the rule first and say why in the
   PR.
3. If you settle something during a session that isn't written down, run the
   `record-intent` skill. It puts a checkable promise in the relevant rule and
   a tradeoff in `decisions/`.
4. Oracles run on every `bun test` and on the Claude Code Stop hook.
