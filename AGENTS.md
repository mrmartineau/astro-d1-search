# zed-package-starter — agent & contributor guide

Starter template for TypeScript npm packages, plus a documentation website. The
repo is a pnpm monorepo with two parts:

| Part        | Where              | What it is                                                                                   |
| ----------- | ------------------ | -------------------------------------------------------------------------------------------- |
| npm package | repo root (`src/`) | The publishable package (`@mrmartineau/npm-package-base`). ESM + CJS dual output via tsdown. |
| Docs site   | `docs/`            | Astro site using `@mrmartineau/zui-theme`, deployed to Cloudflare Workers.                   |

Root `package.json` is the package itself; `docs` is a private workspace
package. `pnpm-workspace.yaml` wires them together (it also holds the vite
catalog and dependency build allowlist — don't remove those).

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

Before committing: `pnpm run check && pnpm run build && pnpm run test`, and
`pnpm run docs:build` if you touched `docs/`.

## The package (`src/`)

- Source in `src/index.ts`, tests co-located as `src/*.test.ts` (Bun test).
- `pnpm run build` emits ESM (`index.mjs`), CJS (`index.cjs`), and `.d.ts`
  types into `dist/`. Only `dist/` is published (`files` field).
- TypeScript config in `tsconfig.json`; lint/format/typecheck via Vite+
  (`vp check`), configured in root `vite.config.ts`.
- Releases prepend notes to `CHANGELOG.md` (via `@semantic-release/changelog`);
  the docs site renders it at `/changelog`.

## The docs site (`docs/`)

Astro + `@mrmartineau/zui-theme` (docs theme built on ZUI). Static output,
served as assets from a Cloudflare Worker.

### Writing documentation

Pages are MDX files under `docs/src/pages/<section>/`. Navigation is
file-based — the sidebar and footer build themselves from the pages; there is
no nav config to maintain.

To add a page, create `docs/src/pages/<section>/<slug>.mdx`:

```mdx
---
layout: ../../layouts/Layout.astro
title: My page
description: One-line summary shown under the heading.
order: 2
---

import { Demo } from "@mrmartineau/zui-theme/astro";

## Usage

<Demo html={`<button class="zui-button">Click me</button>`}>
  <button class="zui-button">Click me</button>
</Demo>
```

Frontmatter conventions (from the theme):

- `title` — sidebar label, page heading, `<title>`. Required.
- `description` — sub-heading + meta description.
- `order` — position within the section (ascending).
- `sectionOrder` — on a section's `index.mdx`, orders the whole section.

New top-level folders under `src/pages/` become new sidebar sections
automatically. Useful theme components: `Demo` (live preview + tabbed source),
`CopyCode`, `TokenGrid`/`TokenRow`, `Section`, `Subtitle`.

### Site chrome

- `docs/src/site.config.ts` — title, description, version badge, social links,
  theme switcher toggles. Update `version` when the package version changes.
- `docs/src/layouts/Layout.astro` — thin wrapper over the theme's
  `DocsLayout`; the `import.meta.glob` calls must stay in this file so paths
  resolve against this project's `src/pages`.
- `docs/src/pages/index.astro` — landing page (hero + section card grids).
- `docs/astro.config.mjs` — Cloudflare adapter (`output: 'static'`), MDX
  integration, Shiki code themes.

## CI & deployment (`.github/workflows/`)

- `build-test.yml` — every PR/push to main: `vp check`, package build, docs
  build, bun tests.
- `deploy-docs.yml` — push to main touching `docs/**` (or manual dispatch):
  builds docs and deploys the `zed-package-starter-docs` Worker via
  wrangler-action. Needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo
  secrets. Wrangler config: `docs/wrangler.jsonc` (assets served from
  `docs/dist/client`).
- `release.yml` — manual dispatch: semantic-release publishes the package to
  npm. Version comes from conventional commits (`fix:` patch, `feat:` minor,
  `feat!:`/`BREAKING CHANGE:` major). Needs `NPM_TOKEN` secret.
- `security.yml` — Aikido safe-chain supply-chain scan on every branch.

CI installs with `--frozen-lockfile`: if you change any `package.json`, run
`pnpm install` and commit the updated `pnpm-lock.yaml`.

## Gotchas

- **Vite+ tooling**: `vp config` (root `prepare` script) sets
  `core.hooksPath` to `.vite-hooks/_`; the `pre-commit` hook runs `vp staged`,
  which runs `vp check --fix` on staged files (see `staged` in
  `vite.config.ts`). If hooks misbehave, `git config --unset core.hooksPath`
  and rerun `pnpm exec vp config`.
- **Changelog**: `docs/src/pages/changelog.astro` imports the root
  `CHANGELOG.md` — don't delete that file; semantic-release prepends release
  notes to it.
- **Worker name** lives in `docs/wrangler.jsonc` (`zed-package-starter-docs`).
  Renaming it deploys a new Worker instead of updating the existing one.
- **Docs build output** goes to `docs/dist/client` (the Cloudflare adapter
  splits client/server); `wrangler.jsonc` points there — don't change one
  without the other.
- **Package rename**: when using this template for a real package, update root
  `package.json` (`name`, `description`, repo URLs), `docs/src/site.config.ts`,
  and the npm link in this file.
- **semantic-release** commits the version bump back to `main` with
  `[skip ci]` — don't hand-edit `version` in root `package.json`.

## Using this repo as a template

See `README.md` for the copy-and-customise checklist, and `SKILL.md` for the
agent skill that scaffolds new packages from these conventions
(`npx skills add mrmartineau/npm-package-base`).
