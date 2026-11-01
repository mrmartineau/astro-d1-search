# Search behaviour

Checked by `src/search.oracle.test.ts`: generated corpora go through the
indexer's own `toSql()` into real SQLite FTS5, then through `searchIndex()`,
and results are compared against a small model. Failures print a shrunk
counterexample.

## R1. A result matches every term; the last term is a prefix

Query `css gri` returns docs containing `css` and a word starting with `gri`,
across title, description, content and tags. Nothing else.

- **Why:** search-as-you-type. AND semantics because users narrow by adding
  words; OR makes long queries worse.
- **Assumes:** porter stemming is on, so `grids` matches `grid`. The model only
  uses stem-form words and doesn't model stemming.
- **Check:** R1 in the oracle.

## R2. `type` filters, never widens or drops

Filtered results equal unfiltered results restricted to that type.

- **Why:** search pages tab by type; counts must agree with "All".
- **Check:** R2.

## R3. Best-first order, stable paging

Scores ascend (bm25 is lower-is-better). Walking `offset` in steps of `limit`
yields every result once, no dupes, no gaps.

- **Why:** "load more" must not repeat or skip.
- **Open question:** equal scores have no tiebreak, so order within a tie is
  whatever SQLite returns. Fine in-process; unverified across D1 replicas. If it
  bites, add `ORDER BY score, url`.
- **Check:** R3.

## R4. Newer beats older, all else equal

Two identical docs, the newer ranks first while it's inside
`recency.windowDays`. Undated docs get no boost.

- **Why:** a personal site's newest writing is usually the most relevant.
  Boost is a multiplier, so it reorders near-ties without burying a strong old
  match.
- **Assumes:** `julianday('now')`, so results drift daily. Acceptable.
- **Check:** R4. Not checked: how much a strong old match must beat a weak new
  one. Decide that before tuning `recency.boost`.

## R5. User input never reaches FTS5 raw

Any string as `q` must not throw, must produce only quoted terms, and a
blank/noise query matches nothing.

- **Why:** an FTS5 syntax error is a 500 from the injected route; unquoted
  operators let users run `NEAR`/`*` queries we didn't design for.
- **History:** the first oracle run found NUL (`?q=ab%00`) unterminated the
  quoted term and threw. `toFtsQuery` now treats control characters as
  separators.
- **Check:** R5 (500 runs of arbitrary binary strings), plus unit cases in
  `core.test.ts`.
