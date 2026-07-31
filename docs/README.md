# astro-d1-search docs

The documentation site for [`astro-d1-search`](../). Built with [Astro](https://astro.build) and
[`@mrmartineau/zui-theme`](https://github.com/mrmartineau/zui), deployed to Cloudflare Workers as a
static site served from Worker assets.

## Commands

Run these from the repo root so pnpm resolves the workspace:

| Command                | Action                                                     |
| :--------------------- | :--------------------------------------------------------- |
| `pnpm run docs:dev`    | Dev server                                                 |
| `pnpm run docs:build`  | Production build to `docs/dist/`                           |
| `pnpm run docs:deploy` | Build and deploy to Cloudflare (needs local wrangler auth) |

## Structure

```text
docs/
├── src/
│   ├── components/
│   │   └── SectionCards.astro   # card grid for a section's pages
│   ├── layouts/
│   │   └── Layout.astro         # wraps the theme's DocsLayout
│   ├── pages/
│   │   ├── guides/              # setup and how-to
│   │   ├── reference/           # options, endpoint, ranking, exports
│   │   ├── changelog.astro      # renders the root CHANGELOG.md
│   │   └── index.astro          # landing page
│   └── site.config.ts           # title, description, links, version
├── astro.config.mjs
└── wrangler.jsonc               # Worker name + asset directory
```

## Adding a page

Create an `.mdx` file under `src/pages/<section>/` — the sidebar and footer build themselves from
the file structure, so there's no nav config to update.

```mdx
---
layout: ../../layouts/Layout.astro
title: My page
description: One-line summary shown under the heading.
order: 5
---

## Usage

Standard Markdown. Code blocks are syntax-highlighted automatically.
```

Frontmatter: `title` (required, used for the sidebar label and `<title>`), `description`, `order`
(position within the section), and `sectionOrder` on a section's `index.mdx` (position of the whole
section).

A new top-level folder under `src/pages/` becomes a new sidebar section. If you add one, also add a
`<SectionCards section="..." />` block to `src/pages/index.astro` so it appears on the landing page.

## Deployment

`.github/workflows/deploy-docs.yml` deploys on any push to `main` that touches `docs/**`, and can be
run manually. It needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets.

Build output goes to `docs/dist/client` (the Cloudflare adapter splits client/server) and
`wrangler.jsonc` points there — don't change one without the other.
