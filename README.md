# zed-package-starter

A starter template for building TypeScript npm packages with ESM + CJS dual output, Vite+ (`vp`) linting/formatting, Bun testing, automated releases via semantic-release, and a documentation website built with Astro + [ZUI](https://github.com/mrmartineau/zui).

This repository is meant to be copied and customised for each new package you publish.

## What's included

- pnpm monorepo: the package at the repo root (`src/`), docs site in `docs/`
- Bundling with `tsdown` (ESM + CJS output with `.d.mts` / `.d.cts` types)
- Linting, formatting, and type-aware checks with Vite+ (`vp check`)
- Pre-commit hook (`vp staged`) installed automatically via `vp config`
- Testing with Bun
- Automated releases via `semantic-release`, with a generated `CHANGELOG.md`
- Docs site using [`@mrmartineau/zui-theme`](https://www.npmjs.com/package/@mrmartineau/zui-theme), deployed to Cloudflare Workers
- GitHub Actions CI: build/test, docs deploy, npm release, supply-chain scan

## How to use this template

1. Create a new repository from this one, or clone/copy it into a new folder.
2. Update `package.json`:
   - change `name`
   - change `description`
   - update `repository`, `homepage`, and `bugs` fields
3. Update `docs/src/site.config.ts` (title, description, links) and `docs/wrangler.jsonc` (`name`).
4. Replace the starter implementation in `src/index.ts` with your package code.
5. Add any runtime dependencies your package needs.
6. Install dependencies and start developing.
7. Add repository secrets in GitHub: `NPM_TOKEN` (publishing), `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (docs deploys).

## Install dependencies

```bash
pnpm install
```

## Development

```bash
# Build ESM, CJS, and type declarations
pnpm run build

# Rebuild on file changes
pnpm run dev

# Check & fix formatting + linting + types
pnpm run check

# Run tests
pnpm run test
```

## Documentation site

```bash
pnpm run docs:dev     # dev server
pnpm run docs:build   # production build
pnpm run docs:deploy  # build + deploy to Cloudflare (needs wrangler auth)
```

Docs pages are MDX files in `docs/src/pages/<section>/` — the sidebar builds itself from the file structure. The package changelog is rendered at `/changelog`. See `AGENTS.md` for the full writing guide.

## Releasing

Run the **NPM Release** workflow from the Actions tab. Version bumps follow [conventional commits](https://www.conventionalcommits.org/):

- `fix:` → patch
- `feat:` → minor
- `feat!:` or `BREAKING CHANGE:` → major

Release notes are prepended to `CHANGELOG.md` automatically. The release job requires a `NPM_TOKEN` repository secret; `GITHUB_TOKEN` is provided automatically by GitHub Actions.

## Project structure

```text
.
├── .github/
│   └── workflows/
│       ├── build-test.yml
│       ├── deploy-docs.yml
│       ├── release.yml
│       └── security.yml
├── docs/               # Astro docs site (@mrmartineau/zui-theme)
├── src/
│   ├── index.ts
│   └── index.test.ts
├── CHANGELOG.md
├── package.json
├── pnpm-workspace.yaml
├── release.config.mjs
├── tsconfig.json
└── vite.config.ts      # Vite+ tooling config (staged, fmt, lint)
```

## Agent Skill

This repo includes an agent skill (`SKILL.md`) that teaches AI coding agents how to scaffold new npm packages using this template's conventions. Install it with [`npx skills`](https://github.com/vercel-labs/skills):

```bash
# Interactive — choose your agent(s) and scope
npx skills add mrmartineau/zed-package-starter

# Install globally for Claude Code
npx skills add mrmartineau/zed-package-starter -g -a claude-code
```

Once installed, your agent will automatically use this skill when asked to create or scaffold a new npm package.

## License

[ISC](https://choosealicense.com/licenses/isc/) © [Zander Martineau](https://zander.wtf)

> Made by Zander • [zander.wtf](https://zander.wtf) • [GitHub](https://github.com/mrmartineau/)
