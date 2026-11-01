# Search behaviour

Checked by `src/search.oracle.test.ts`: generated corpora go through the
indexer's own `toSql()` into real SQLite FTS5, then through `searchIndex()`,
and results are compared against a small model. Failures print a shrunk
counterexample.

## R1. A result matches every term; the last term is a prefix

Query `css gri` returns docs containing `css` and a word starting with `gri`,
across title, description, content and tags. Nothing else. Terms with no
letters or digits (`!`, `&&`) are ignored, then only the first `maxTerms`
(default 8) are used. A query with no real terms matches nothing.

- **Why:** search-as-you-type. AND semantics because users narrow by adding
  words; OR makes long queries worse.
- **Assumes:** porter stemming is on, so `grids` matches `grid`. The model only
  uses stem-form words and doesn't model stemming.
- **History:** punctuation-only terms used to stay in the MATCH. FTS5 drops
  them, and as the last term they took the prefix `*` with them, so `gr !`
  didn't match `grid`. `toFtsQuery` now drops them first.
- **Check:** R1 in the oracle. Queries mix in punctuation noise and truncate
  the last real word so prefix vs exact matters.

## R2. `type` filters, never widens or drops

Filtered results equal unfiltered results restricted to that type.

- **Why:** search pages tab by type; counts must agree with "All".
- **Check:** R2.

## R3. Best-first order, deterministic paging

Scores ascend (bm25 is lower-is-better); equal scores order by `url`. Walking
`offset` in steps of `limit` yields exactly the full list, in order.

- **Why:** "load more" must not repeat or skip. Without a tiebreak, separate
  page requests can order a tie differently.
- **Check:** R3 checks tie order and that pages concatenate to the full list.

## R4. Newer beats older, all else equal

Two identical docs, the newer ranks first while it's inside
`recency.windowDays`. Undated docs get no boost.

- **Why:** a personal site's newest writing is usually the most relevant.
  Boost is a multiplier, so it reorders near-ties without burying a strong old
  match.
- **Assumes:** `julianday('now')`, so results drift daily. Acceptable.
- **Check:** R4 (newer vs older, and dated vs undated). Not checked: how much
  a strong old match must beat a weak new one. Decide that before tuning
  `recency.boost`.

## R5. User input never reaches FTS5 raw

Any string as `q` must not throw, must produce only quoted terms, and a
blank/noise query matches nothing.

- **Why:** an FTS5 syntax error is a 500 from the injected route; unquoted
  operators let users run `NEAR`/`*` queries we didn't design for.
- **History:** the first oracle run found NUL (`?q=ab%00`) unterminated the
  quoted term and threw. `toFtsQuery` now treats control characters as
  separators.
- **Check:** R5 (500 runs of arbitrary binary strings; any input that reduces
  to no terms must return nothing), plus unit cases in `core.test.ts`.
