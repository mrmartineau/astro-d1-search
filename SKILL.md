---
name: astro-d1-search
description: "Add full-text site search to an Astro site using Cloudflare D1 (SQLite FTS5) with the astro-d1-search integration: build-time content indexing, an injected /api/search endpoint, bm25 + recency ranking, and server-rendered search pages. Use when asked to add search to an Astro site, index content into D1, set up FTS5 search, or work with an existing astro-d1-search setup."
---

# astro-d1-search

Site search for Astro backed by Cloudflare D1 (SQLite FTS5). Content is indexed
at build time by a script; queries are served either by an injected API route or
directly from server-rendered pages.

Requires the `@astrojs/cloudflare` adapter. The site itself can stay
`output: 'static'` — only the search endpoint is server-rendered.

## Architecture

Three parts, wired together by one shared options object:

| Part        | Where                                             | Job                                                                                             |
| ----------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Integration | `astro.config.mjs`                                | Injects `/api/search`, serves config to it via a Vite virtual module, validates wrangler config |
| Indexer     | `scripts/build-search-index.ts`                   | Parses markdown, emits SQL, pushes via `wrangler d1 execute`                                    |
| Query layer | `/api/search` route, or `searchIndex()` in a page | Runs the FTS5 query and ranks results                                                           |

The options object **must** live in its own module (conventionally
`search.config.ts` at the project root) so all three import the same one. If the
integration and the indexer disagree, pages get ranked differently from the
endpoint.

## Setup workflow

1. `pnpm add astro-d1-search` (plus `@astrojs/cloudflare` and `wrangler` if absent)
2. `wrangler d1 create <name>` — note the returned `database_id`
3. Add the `[[d1_databases]]` binding to `wrangler.toml` / `wrangler.jsonc`
4. Write `search.config.ts`
5. Add the integration to `astro.config.mjs`, with `platformProxy: { enabled: true }` on the adapter
6. Write `scripts/build-search-index.ts` and add the `search:index` / `search:push` scripts
7. Run `pnpm search:index`, then `pnpm dev`, then hit `/api/search?q=test`
8. Add the index push to CI, **after** the deploy step

There is no migration step — the indexer prepends
`CREATE VIRTUAL TABLE IF NOT EXISTS` to every push.

## Files to create

### `search.config.ts`

```ts
import type { D1SearchOptions } from "astro-d1-search";

const searchConfig: D1SearchOptions = {
  database: "my-site-search",
  binding: "SEARCH_DB",
  // Set `site` only when several sites share one database
  sources: [
    { dir: "src/content/blog", type: "blog", url: "/blog/:slug" },
    { dir: "src/content/notes", type: "note", url: "/notes/:slug" },
    // No :slug — every doc in this source maps to the same page
    { dir: "src/content/worklog", type: "worklog", url: "/worklog" },
    { files: ["src/pages/about.mdx"], type: "page", url: "/:slug" },
  ],
};

export default searchConfig;
```

Map one source per content collection, plus one `files` source for standalone
pages. `type` values are arbitrary strings and become the endpoint's `type`
allowlist.

### `astro.config.mjs`

```js
import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";
import d1Search from "astro-d1-search";
import searchConfig from "./search.config.ts";

export default defineConfig({
  output: "static",
  adapter: cloudflare({ platformProxy: { enabled: true } }),
  integrations: [d1Search(searchConfig)],
});
```

`platformProxy` is required for local dev — it exposes the local D1 binding to
`astro dev` through `Astro.locals.runtime.env`.

### `scripts/build-search-index.ts`

```ts
import { runCli } from "astro-d1-search/indexer";
import searchConfig from "../search.config";

runCli(searchConfig);
```

### `package.json`

```json
{
  "scripts": {
    "search:index": "tsx scripts/build-search-index.ts",
    "search:push": "tsx scripts/build-search-index.ts --target=remote"
  }
}
```

Also add `search-index.sql` to `.gitignore` — it's a build artifact.

### `wrangler.toml`

```toml
[[d1_databases]]
binding = "SEARCH_DB"
database_name = "my-site-search"
database_id = "<from wrangler d1 create>"
```

## Server-rendered search page

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

Three things are load-bearing: `prerender = false`, passing the resolved config
as the third argument (otherwise you silently get `DEFAULT_RANKING`), and
`set:html` to render the `<mark>` tags.

Pass `type: 'note'` for a section-scoped search page.

## Import from the right entry point

| Entry                     | Use in                                                  | Note                    |
| ------------------------- | ------------------------------------------------------- | ----------------------- |
| `astro-d1-search`         | `astro.config.mjs`, build scripts, `.astro` frontmatter | Re-exports everything   |
| `astro-d1-search/core`    | Runtime code, Worker bundles, shared utils              | No Node built-ins       |
| `astro-d1-search/indexer` | Build scripts only                                      | Filesystem + `wrangler` |

## Frontmatter the indexer reads

- `title` — **required**; documents without one are silently skipped
- `subtitle` or `description` — the `description` column
- `tags` — array, joined with spaces
- `date` or `modified` — truncated to `YYYY-MM-DD`, drives the recency boost
- `emoji` — returned with results
- `slug` — overrides the filename-derived slug

Slug resolution matches Astro: frontmatter `slug`, else the filename, else the
directory name for `<dir>/index.md`.

## Options quick reference

| Option                                      | Default                                              | Note                                              |
| ------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| `database`                                  | required                                             | `wrangler d1 create <name>`                       |
| `binding`                                   | `'SEARCH_DB'`                                        | Must match wrangler config                        |
| `site`                                      | `''`                                                 | Set to scope index pushes when sharing a database |
| `sources`                                   | required                                             | Needs `dir` or `files` per entry                  |
| `apiRoute`                                  | `'/api/search'`                                      | `false` disables injection                        |
| `cors`                                      | `true`                                               | `Access-Control-Allow-Origin: *`                  |
| `cacheMaxAge`                               | `300`                                                | Seconds; also the edge cache lifetime             |
| `maxLimit` / `maxOffset` / `maxQueryLength` | `25` / `200` / `100`                                 | Validation caps                                   |
| `weights`                                   | `{ title: 10, description: 5, content: 1, tags: 3 }` | bm25 per column; partials merge                   |
| `recency`                                   | `{ boost: 0.35, windowDays: 1095 }`                  | `boost: 0` disables                               |
| `maxTerms`                                  | `8`                                                  | Terms taken from a query                          |
| `snippetTokens`                             | `24`                                                 | Snippet length                                    |
| `maxContentLength`                          | `8000`                                               | Characters kept per document                      |

Ranking is computed at query time, so changing `weights` or `recency` takes
effect immediately — no reindex needed.

## CI

Deploy first, push the index second, so newly-indexed pages already exist:

```yaml
- run: pnpm build
- run: npx wrangler pages deploy dist --project-name=my-site
- run: pnpm search:push
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

The API token needs **Account → D1 → Edit** on top of the deploy scope.

## Troubleshooting

| Symptom                              | Cause                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `500`, "D1 binding … not found"      | Binding missing from wrangler config, or `platformProxy` not enabled in dev |
| Endpoint returns `[]` for everything | Index never pushed — run `pnpm search:index`                                |
| One page missing from results        | Missing `title` in its frontmatter                                          |
| Results link to 404s                 | Index pushed before the deploy, or a wrong `url` pattern in a source        |
| `400 Invalid type`                   | The `type` param isn't one of the `type` values in `sources`                |
| Wrangler permission error on push    | Token lacks D1 Edit                                                         |

## Constraints

- Every push is a full rebuild (delete-all, insert-all); the index is briefly
  empty mid-push.
- `tokenize = 'porter unicode61'` is English-only stemming. Multilingual content
  needs a forked `SCHEMA_SQL` and a table drop, since the tokenizer is fixed at
  creation.
- The endpoint is open and CORS-`*` by default. That's intended for public
  content sites; use `apiRoute: false` or an access policy otherwise.
- FTS5 has no cheap total count — build next/previous paging, not "N of M".
