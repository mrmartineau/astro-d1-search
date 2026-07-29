# zed-astro-starter

An opinionated [Astro](https://astro.build) starter, ready to deploy to Cloudflare Workers.

## What's included

- **[Astro 7](https://astro.build)** — static output by default
- **[ZUI](https://github.com/mrmartineau/zui)** — CSS-first UI library (`@mrmartineau/zui`) with Astro component wrappers, design tokens, and a built-in reset/base layer
- **[Vite+](https://viteplus.dev)** — unified toolchain (`vp`) for formatting, linting, type checking, and testing
- **[Cloudflare Workers](https://developers.cloudflare.com/workers/)** — via the `@astrojs/cloudflare` adapter, with static assets served from a Worker
- **GitHub Actions** — deploy on push to `main`, plus an [Aikido safe-chain](https://github.com/AikidoSec/safe-chain) supply-chain scan on every branch

## Project structure

```text
/
├── .github/workflows/
│   ├── deploy.yml          # Build + deploy to Cloudflare on push to main
│   └── security.yml        # Supply-chain scan on every branch
├── public/                 # Static assets, copied verbatim
├── src/
│   ├── components/
│   │   ├── Masthead.astro  # Site header with navigation
│   │   └── Footer.astro    # Copyright + current year
│   ├── layouts/
│   │   └── BaseLayout.astro # Wraps every page; ZUI CSS, head slot, masthead, footer
│   └── pages/
│       └── index.astro     # Routes map to files in this directory
├── astro.config.mjs        # Astro + Cloudflare adapter config
└── wrangler.jsonc          # Cloudflare Worker config
```

## Layout

Every page wraps itself in `BaseLayout`, which pulls in the ZUI stylesheet and renders the masthead and footer:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro'
---

<BaseLayout title="Page title" description="Optional meta description">
  <link slot="head" rel="preload" href="…" />  <!-- optional extra head content -->
  <p>Page content</p>
</BaseLayout>
```

Styling comes from ZUI: use its components (`@mrmartineau/zui/astro`), design tokens (`--space-*`, `--color-*`, `--step-*`, …), and utility classes rather than hard-coded values. ZUI owns the CSS reset and base layer.

## Commands

All commands run from the project root:

| Command        | Action                                            |
| :------------- | :------------------------------------------------ |
| `vp install`   | Install dependencies                              |
| `pnpm dev`     | Start local dev server at `localhost:4321`        |
| `pnpm build`   | Build the production site to `./dist/`            |
| `pnpm preview` | Preview the build locally                         |
| `pnpm deploy`  | Build and deploy to Cloudflare (needs local auth) |
| `vp check`     | Format, lint, and type check                      |
| `vp test`      | Run tests                                         |

## Deployment

Pushing to `main` (or running the _Deploy to Cloudflare_ workflow manually) builds the site and deploys it to Cloudflare Workers with [`cloudflare/wrangler-action`](https://github.com/cloudflare/wrangler-action). Static files are served as Worker assets from `dist/client`.

One-time setup:

1. Add repository secrets (GitHub → Settings → Secrets and variables → Actions):
   - `CLOUDFLARE_API_TOKEN` — API token with Workers edit permission
   - `CLOUDFLARE_ACCOUNT_ID` — from the Cloudflare dashboard
2. If the project was ever connected to Cloudflare's built-in Git integration, disable it so the two deploy paths don't conflict.
