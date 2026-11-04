# 0001. Check search behaviour against real FTS5, not SQL text

**Status:** accepted, 2026-11-01

## Context

`core.test.ts` asserts on the SQL string and bindings sent to a fake D1. That
catches injection regressions but says nothing about what a user sees. A
ranking change can rewrite the SQL, pass every snapshot-style assertion, and
still return the wrong docs. Nothing in the repo exercised the package end to
end (see CLAUDE.md).

## Decision

Add `src/search.oracle.test.ts`: property tests (fast-check) that load
generated docs through the indexer's own `toSql()` into `bun:sqlite` (FTS5,
same engine D1 uses), run `searchIndex()`, and compare to a small model. Rules
live in `intent/search.md`.

Keep `core.test.ts` for exact SQL/binding guarantees; it's cheap and precise.

## Consequences

- Behaviour regressions surface as a shrunk counterexample, readable by a
  person or an agent.
- First run found a real bug (NUL in `q` → FTS5 error → 500). Fixed.
- `bun:sqlite` FTS5 is not D1. Differences in SQLite version or replica
  behaviour aren't covered. Tie ordering (R3 open question) is the likeliest
  gap.
- Adds `fast-check` as a dev dependency. Suite adds ~1s.
