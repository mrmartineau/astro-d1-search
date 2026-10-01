# astro-d1-search

Site search for [Astro](https://astro.build) backed by [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite [FTS5](https://www.sqlite.org/fts5.html)).

One integration gives you:

- **Build-time indexing** of any markdown/MDX content (content collections, standalone pages, anything) into a D1 full-text index
- **An injected API endpoint** (`GET /api/search`) with bm25 + recency ranking, highlighted snippets, type filtering, input validation and edge caching
- **A query function** (`searchIndex`) for server-rendered search pages that hit the D1 binding directly
- **Content-type agnostic design**: types are strings you choose; one index can serve site-wide and per-section search, and even several sites at once

Requires the [`@astrojs/cloudflare`](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) adapter. The rest of your site can stay fully static; only the search endpoint runs server-side.

📖 **Full documentation**: the [`docs/`](./docs) site (`pnpm run docs:dev` to read it locally, `pnpm run docs:deploy` to publish it).

🤖 **Using a coding agent?** Install the packaged skill and ask it to do the setup for you:

```sh
npx skills add mrmartineau/astro-d1-search
```

It teaches the agent the architecture, the setup order, every file to create and the failure modes. See [`SKILL.md`](./SKILL.md).

## Install

```sh
pnpm add astro-d1-search
```

## Quick start

### 1. Create the database

```sh
wrangler d1 create my-site-search
```

### 2. Configure the binding

Add to `wrangler.toml` (the integration checks this at startup and warns with this exact snippet if it's missing):

```toml
pages_build_output_dir = "./dist"   # if deploying with `wrangler pages deploy`

[[d1_databases]]
binding = "SEARCH_DB"
database_name = "my-site-search"
database_id = "<id from step 1>"
```

If you deploy with `wrangler pages deploy` (or Workers with assets), the binding is applied from this file on deploy — no dashboard configuration needed.

There is **no migration step**: the indexer creates the FTS5 table on first push (`CREATE VIRTUAL TABLE IF NOT EXISTS`).

### 3. Add the integration

```js
// astro.config.mjs
import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";
import d1Search from "astro-d1-search";

export default defineConfig({
  output: "static",
  adapter: cloudflare({ platformProxy: { enabled: true } }),
  integrations: [
    d1Search({
      database: "my-site-search",
      sources: [
        { dir: "src/content/blog", type: "blog", url: "/blog/:slug" },
        { dir: "src/content/notes", type: "note", url: "/notes/:slug" },
        { files: ["src/pages/about.mdx"], type: "page", url: "/:slug" },
      ],
    }),
  ],
});
```

`platformProxy` matters: it gives `astro dev` access to your **local** D1 database, so the whole stack works offline.

### 4. Index your content

Add package scripts:

```json
"search:index": "tsx scripts/build-search-index.ts",
"search:push": "tsx scripts/build-search-index.ts --target=remote"
```

with a three-line script:

```ts
// scripts/build-search-index.ts
import { runCli } from "astro-d1-search/indexer";
import searchConfig from "../search.config";

runCli(searchConfig);
```

Keep the options object in its own module (e.g. `search.config.ts`) so the Astro config and the index script share one source of truth.

Run `pnpm search:index`, start `astro dev`, and `http://localhost:4321/api/search?q=hello` is live.

### 5. Automate in CI

Deploy first, then push the index, so new pages exist before they're searchable:

```yaml
- run: pnpm build
- run: npx wrangler pages deploy dist --project-name=my-site
- run: pnpm search:push
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

The API token needs **Account → D1 → Edit** alongside the usual deploy scope.

## Options

| Option                                      | Default                                              | Description                                                                                                          |
| ------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `database`                                  | required                                             | D1 database name (`wrangler d1 create <name>`)                                                                       |
| `binding`                                   | `'SEARCH_DB'`                                        | D1 binding name in wrangler config                                                                                   |
| `site`                                      | `''`                                                 | Value for the `site` column. When set, pushes replace only this site's rows, so several sites can share one database |
| `sources`                                   | required                                             | Content sources; see below                                                                                           |
| `apiRoute`                                  | `'/api/search'`                                      | Injected endpoint pattern, or `false` to disable                                                                     |
| `cors`                                      | `true`                                               | Send `Access-Control-Allow-Origin: *`                                                                                |
| `cacheMaxAge`                               | `300`                                                | `Cache-Control` max-age (seconds); also used for edge caching                                                        |
| `maxLimit` / `maxOffset` / `maxQueryLength` | `25` / `200` / `100`                                 | Request validation caps                                                                                              |
| `weights`                                   | `{ title: 10, description: 5, content: 1, tags: 3 }` | bm25 per-column weights                                                                                              |
| `recency`                                   | `{ boost: 0.35, windowDays: 1095 }`                  | Recency multiplier: ×(1 + boost) today, linear falloff to ×1 at `windowDays`. `boost: 0` disables                    |
| `maxTerms`                                  | `8`                                                  | Max terms taken from a query                                                                                         |
| `snippetTokens`                             | `24`                                                 | Approximate snippet length                                                                                           |
| `maxContentLength`                          | `8000`                                               | Content truncation per document (characters)                                                                         |

### Sources

Each source maps files to a `type` and a URL pattern:

```ts
{ dir: 'src/content/blog', type: 'blog', url: '/blog/:slug' }
{ files: ['src/pages/about.mdx'], type: 'page', url: '/:slug' }
{ dir: 'src/content/worklog', type: 'worklog', url: '/worklog' } // no :slug — all docs share one page
```

- `:slug` is replaced with the document slug, resolved the same way Astro does it: frontmatter `slug` if present, otherwise the file name (or directory name for `<dir>/index.md`).
- Frontmatter used per document: `title` (required — untitled documents are skipped), `subtitle`/`description`, `tags`, `date`/`modified`, `emoji`.
- `type` is any string you like. The endpoint validates its `type` param against the set of types in your sources.
- Markdown is flattened to plain text. Text inside code fences is **kept** (so code is searchable); fences, inline-code backticks, markdown syntax, HTML/JSX tags and MDX imports are stripped.

## The API

```
GET /api/search?q=<query>&limit=<n>&offset=<n>&type=<type>
```

Response:

```json
{
  "query": "css grid",
  "results": [
    {
      "title": "CSS Grid",
      "url": "https://example.com/notes/css-grid",
      "type": "note",
      "date": "2023-01-20",
      "tags": "css",
      "emoji": "🍱",
      "snippet": "…display: <mark>grid</mark>; <mark>grid</mark>-template…",
      "score": -7.71
    }
  ]
}
```

- Results are ranked by bm25 × recency multiplier; **lower (more negative) score = better match**.
- `snippet` contains `<mark>` around matched terms. Safe to render as HTML only if your indexed content is trusted (your own markdown normally is).
- Queries shorter than 2 characters return an empty result set; malformed `limit`/`offset`/`type` return 400.
- User input never reaches FTS5 raw: every term is quoted (neutralising `AND`/`OR`/`NEAR()`/`*`/`-` operators) and the last term gets a `*` suffix for prefix matching — search-as-you-type works out of the box.
- Responses are cached at the Cloudflare edge under a canonicalised key (lowercased query, fixed param order), so repeated queries don't hit D1.

## Server-rendered search pages

Skip HTTP and query D1 directly from a page's frontmatter:

```astro
---
export const prerender = false

import { resolveConfig, searchIndex } from 'astro-d1-search/core'
import searchConfig from '../../search.config'

const config = resolveConfig(searchConfig)
const query = Astro.url.searchParams.get('q')?.trim() || ''

const results =
  query.length >= 2
    ? await searchIndex(Astro.locals.runtime.env.SEARCH_DB, { query, limit: 25 }, config)
    : []
---

{
  results.map((result) => (
    <article>
      <a href={result.url}>{result.title}</a>
      {result.snippet && <p set:html={result.snippet} />}
    </article>
  ))
}
```

Pass `type: 'note'` (or any of your types) for a section-scoped search page.

## Multi-site

Set a distinct `site` per project and point them all at the same `database`. Each site's index push replaces only its own rows (`DELETE ... WHERE site = ?`), and each site's endpoint serves its own content. A shared cross-site endpoint is then one Worker away.

## Examples

[**zander.wtf**](https://zander.wtf) is the site this package was extracted from. It indexes five
content types into one D1 database and searches them without a byte of client-side JavaScript.

- [zander.wtf/search](https://zander.wtf/search) — site-wide search page with type filters
- [zander.wtf/notes/search](https://zander.wtf/notes/search) — the same index scoped to one type
- [`/api/search?q=astro`](https://zander.wtf/api/search?q=astro&limit=5) — the injected endpoint

Source ([mrmartineau/zander.wtf](https://github.com/mrmartineau/zander.wtf)):

| File                                                                                                                 | What it shows                                                     |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [`search.config.ts`](https://github.com/mrmartineau/zander.wtf/blob/main/search.config.ts)                           | The shared options object — sources, URL patterns, recency tuning |
| [`astro.config.mjs`](https://github.com/mrmartineau/zander.wtf/blob/main/astro.config.mjs)                           | Wiring the integration with that config                           |
| [`scripts/build-search-index.ts`](https://github.com/mrmartineau/zander.wtf/blob/main/scripts/build-search-index.ts) | The three-line indexer CLI wrapper                                |
| [`src/utils/search.ts`](https://github.com/mrmartineau/zander.wtf/blob/main/src/utils/search.ts)                     | Wrapping `searchIndex()` once to narrow `type` to a union         |
| [`src/pages/search.astro`](https://github.com/mrmartineau/zander.wtf/blob/main/src/pages/search.astro)               | Site-wide server-rendered search page                             |
| [`src/pages/notes/search.astro`](https://github.com/mrmartineau/zander.wtf/blob/main/src/pages/notes/search.astro)   | The section-scoped variant, 30 lines                              |

That site develops the package as a workspace package rather than installing it from npm, so its
imports read `./packages/astro-d1-search/src/...` where yours read `astro-d1-search/...`.

The docs site's [Examples guide](./docs/src/pages/guides/examples.mdx) walks through what's worth
copying from it. Using this package? Open a PR adding your site.

## Constraints

- **Full rebuild per push**: the index is briefly empty (or site-scoped-empty) mid-push. Fine at personal-site scale.
- **`porter` stemming is English-only.** The schema uses `tokenize = 'porter unicode61'`; fork the schema in `indexer.ts` for multilingual content.
- **Open endpoint by default.** It serves the same data as your public site. Put it behind a token check if yours isn't public.
- **D1 free tier**: 5GB storage, 5M rows read/day — orders of magnitude above a typical content site's needs.

## Contributing

This repo is a pnpm monorepo: the package at the root (`src/`), the documentation site in `docs/`.

```sh
pnpm install
pnpm run build      # tsdown → dist/ (ESM + .d.mts)
pnpm run dev        # rebuild on change
pnpm run test       # bun test
pnpm run check      # vp check --fix (format + lint + typecheck)
pnpm run docs:dev   # docs site dev server
pnpm run docs:build # build the docs site
```

See `AGENTS.md` for the full contributor and agent guide.

## More Astro packages

Other Astro tools I have made:

- [astro-git-dates](https://github.com/mrmartineau/astro-git-dates): set content collection dates from git history
- [zed-astro-starter](https://github.com/mrmartineau/zed-astro-starter): an opinionated Astro starter, ready to deploy to Cloudflare Workers
- [ZUI](https://github.com/mrmartineau/zui): a CSS-first UI library with Astro (and React, Solid, Svelte, Vue) components

## License

[MIT](https://choosealicense.com/licenses/mit/) © [Zander Martineau](https://zander.wtf)

> Made by Zander • [zander.wtf](https://zander.wtf) • [GitHub](https://github.com/mrmartineau/)
