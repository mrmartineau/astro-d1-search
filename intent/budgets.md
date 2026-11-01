# Budgets and runtime constraints

## B1. Worker-side code imports nothing from Node

`core.ts`, `config.ts` and `route.ts` run inside a Cloudflare Worker. They may
import only each other, `astro` types and the virtual config module.

- **Why:** a Node built-in in the Worker bundle fails at deploy or at first
  request, not at build.
- **Check:** `src/intent.test.ts` scans their imports.

## B2. No `@cloudflare/workers-types` dependency

D1 is typed structurally (`D1Like`).

- **Why:** its `Cache` type clashes with the DOM lib in consumer projects.
- **Check:** `src/intent.test.ts` asserts it's absent from `package.json`.

## B3. Only config numbers are interpolated into SQL

Query, type, limit and offset are always bound parameters.

- **Check:** `core.test.ts` ("binds the match expression…") plus oracle R5.

## Not yet budgeted

Candidates once there's a real deployment to measure against: p95 latency of
`/api/search` on a 1k-doc index, indexer SQL size per 100 docs, `dist/core.mjs`
size. Add each with a number and a check, or leave it here.
