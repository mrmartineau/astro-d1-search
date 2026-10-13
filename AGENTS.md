# astro-d1-search — agent & contributor guide

`CLAUDE.md` is a symlink to this file — edit one, both change.

Site search for Astro backed by Cloudflare D1 (SQLite FTS5). The repo is a pnpm
monorepo with two parts:

| Part        | Where              | What it is                                                                 |
| ----------- | ------------------ | -------------------------------------------------------------------------- |
| npm package | repo root (`src/`) | The publishable package (`astro-d1-search`). ESM-only output via tsdown.   |
| Docs site   | `docs/`            | Astro site using `@mrmartineau/zui-theme`, deployed to Cloudflare Workers. |

Root `package.json` is the package itself; `docs` is a private workspace package.
`pnpm-workspace.yaml` wires them together (it also holds the vite catalog and the
dependency build allowlist — don't remove those).

## Commands

Run everything from the repo root. pnpm for installs, Bun as the test runner.

```sh
pnpm install              # install all workspace deps
pnpm run build            # build the package (tsdown → dist/)
pnpm run dev              # rebuild package on change
pnpm run test             # bun test (src/*.test.ts)
pnpm run check            # vp check --fix (format + lint + typecheck, whole repo)
pnpm run docs:dev         # docs dev server (portless + astro dev)
pnpm run docs:build       # build docs site
pnpm run docs:deploy      # build + wrangler deploy (needs Cloudflare auth)
```

Single test file / single case:

```sh
bun test src/core.test.ts             # one file
bun test -t "quotes every term"       # one case, by name pattern
```

Before committing: `pnpm run check && pnpm run build && pnpm run test`, and
`pnpm run docs:build` if you touched `docs/`.

Node: root package needs `>=20.19.0`, `docs/` needs `>=22.12.0` — use the
higher one.

## The package (`src/`)

Six modules, three of them public entry points:

| Module        | Entry point                 | Role                                                              |
| ------------- | --------------------------- | ----------------------------------------------------------------- |
| `index.ts`    | `astro-d1-search`           | The Astro integration; re-exports everything else                 |
| `core.ts`     | `astro-d1-search/core`      | `searchIndex`, `toFtsQuery`. **Must stay free of Node built-ins** |
| `indexer.ts`  | `astro-d1-search/indexer`   | Filesystem walking, SQL generation, `wrangler` push, CLI          |
| `config.ts`   | (internal)                  | Options types and `resolveConfig`                                 |
| `markdown.ts` | (internal)                  | `markdownToPlainText`, `sqlEscape`                                |
| `route.ts`    | (built to `dist/route.mjs`) | The injected API endpoint                                         |

Two flows, and nothing crosses between them at runtime:

- **Build time (Node).** `indexer.ts` walks each `source.dir`, parses
  frontmatter with `@11ty/gray-matter`, flattens the body via
  `markdownToPlainText`, and emits one SQL file — `SCHEMA_SQL` (a
  `CREATE VIRTUAL TABLE IF NOT EXISTS`, so no migration step), a delete of the
  site's existing rows, then batched INSERTs kept under
  `MAX_STATEMENT_BYTES`. `buildIndex` shells out to
  `npx wrangler d1 execute … --file=` to push it. `runCli` reads
  `--target=remote` / `--dry-run` from argv; consumers call it from their own
  script.
- **Request time (Worker).** The integration injects `route.ts` at
  `config.apiRoute`. It validates `q`/`limit`/`offset`/`type`, pulls the D1
  binding off `locals.runtime.env[config.binding]`, and calls
  `searchIndex` from `core.ts`, which builds the bm25 + recency SQL.

`resolveConfig` in `config.ts` is the single source of defaults for both — every
limit, weight and recency number lives there, so change a default in one place.

Design rules worth preserving:

- **`core.ts` imports nothing from Node.** It runs inside a Worker. It also
  deliberately uses a structural `D1Like` type rather than depending on
  `@cloudflare/workers-types`, whose `Cache` type conflicts with the DOM lib's.
- **User input never reaches FTS5 raw.** `toFtsQuery` quotes every term; the
  query, type, limit and offset are bound parameters. The only values
  interpolated into SQL are numbers from the resolved config.
- **`route.ts` is a build-time-resolved file path**, not a module specifier.
  `resolveRouteEntrypoint()` in `index.ts` probes for `route.mjs` / `route.js` /
  `route.ts` next to itself, so the integration works both when installed from
  npm and when a monorepo imports `src/index.ts` directly. Keep that probe if you
  change the build.
- **`virtual:astro-d1-search-config`** carries the serialisable config from the
  integration to the route. It's declared in `src/env.d.ts` and marked
  `deps.neverBundle` in `tsdown.config.ts` — the consuming project's Vite
  resolves it, not ours.

Tests live beside the source as `src/*.test.ts` (Bun test) and stub D1 with a
fake `prepare`/`bind`/`all`, asserting on the SQL text and bound params — no
real database involved. **The docs site does not consume the integration**, so
there is nothing in this repo that exercises the package end to end; verifying
real behaviour means wiring it into a separate Astro project. `pnpm run build`
emits ESM (`.mjs`) plus `.d.mts` types into `dist/`, which is the only published
directory (`files` field). Releases prepend notes to `CHANGELOG.md`; the docs
site renders it at `/changelog`.

## The docs site (`docs/`)

Astro + `@mrmartineau/zui-theme`. Static output, served as assets from a
Cloudflare Worker (`astro-d1-search-docs`).

Two sections: `guides/` (getting started, indexing content, search pages,
deploying, agent skill, examples) and `reference/` (configuration, API
endpoint, ranking, exports), plus a top-level `changelog.astro`.

### Writing documentation

Pages are MDX under `docs/src/pages/<section>/`. Navigation is file-based — the
sidebar and footer build themselves; there is no nav config to maintain.

```mdx
---
layout: ../../layouts/Layout.astro
title: My page
description: One-line summary shown under the heading.
order: 2
---

## Usage

Standard Markdown; code blocks are highlighted automatically.
```

Frontmatter conventions (from the theme):

- `title` — sidebar label, page heading, `<title>`. Required.
- `description` — sub-heading + meta description.
- `order` — position within the section (ascending).
- `sectionOrder` — on a section's `index.mdx`, orders the whole section.

New top-level folders under `src/pages/` become new sidebar sections
automatically; add a matching `<SectionCards section="..." />` to
`src/pages/index.astro` so they show on the landing page.

Useful theme components: `Demo` (live preview + tabbed source), `CopyCode`,
`TokenGrid`/`TokenRow`, `Section`, `Subtitle`. There is no `zui-callout` class —
use a blockquote for asides.

## CI & deployment (`.github/workflows/`)

- `build-test.yml` — every PR/push to main: `vp check`, package build, docs
  build, bun tests.
- `deploy-docs.yml` — push to main touching `docs/**` (or manual dispatch):
  deploys the `astro-d1-search-docs` Worker via wrangler-action. Needs
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo secrets. Wrangler config:
  `docs/wrangler.jsonc` (assets served from `docs/dist/client`).
- `release.yml` — manual dispatch: semantic-release publishes to npm. Version
  from conventional commits (`fix:` patch, `feat:` minor, `feat!:`/
  `BREAKING CHANGE:` major). Needs `NPM_TOKEN`.
- `security.yml` — Aikido safe-chain supply-chain scan on every branch.

CI installs with `--frozen-lockfile`: if you change any `package.json`, run
`pnpm install` and commit the updated `pnpm-lock.yaml`.

## Gotchas

- **Astro scans page source for a `prerender` export, code fences included.** A
  docs page whose examples contain `export const prerender = false` gets treated
  as server-rendered and silently vanishes from `dist/client` — a 404 on an
  assets-only Worker, with no build error.
  `docs/src/pages/guides/search-pages.mdx` counters this with a real
  `export const prerender = true`. Keep it, and watch for the same trap in new
  pages. Verify with `find docs/dist/client -name index.html` after a build.
- **Vite+ tooling**: `vp config` (root `prepare` script) sets `core.hooksPath` to
  `.vite-hooks/_`; the `pre-commit` hook runs `vp staged`, which runs
  `vp check --fix` on staged files (see `staged` in `vite.config.ts`). If hooks
  misbehave, `git config --unset core.hooksPath` and rerun `pnpm exec vp config`.
- **Changelog**: `docs/src/pages/changelog.astro` imports the root
  `CHANGELOG.md` — don't delete that file; semantic-release prepends to it.
- **Worker name** lives in `docs/wrangler.jsonc`. Renaming it deploys a _new_
  Worker instead of updating the existing one.
- **Docs build output** goes to `docs/dist/client` (the Cloudflare adapter splits
  client/server); `wrangler.jsonc` points there — don't change one without the
  other.
- **Version bumps**: semantic-release commits them back to `main` with
  `[skip ci]` — don't hand-edit `version` in root `package.json`. Do update
  `version` in `docs/src/site.config.ts`, which drives the header badge.
- **`@11ty/gray-matter`** is the frontmatter parser, not `gray-matter`. It's a
  runtime dependency of the published package.

## The agent skill

`SKILL.md` (repo root) teaches agents how to _use_ the package — set it up in an Astro
project, wire the config, troubleshoot. It's installable with
[`npx skills`](https://github.com/vercel-labs/skills):

```sh
npx skills add mrmartineau/astro-d1-search
```

Keep it in step with the docs when options or behaviour change.
