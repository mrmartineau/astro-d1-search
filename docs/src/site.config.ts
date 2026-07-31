import type { SiteConfig } from "@mrmartineau/zui-theme/nav";

/**
 * Global configuration for the docs site. This drives the header, footer,
 * page titles, and theme controls. Keep `version` in step with the published
 * package.
 */
export const site: SiteConfig = {
  author: "Zander Martineau",
  authorHref: "https://zander.wtf",
  description:
    "Site search for Astro, backed by Cloudflare D1 (SQLite FTS5): build-time indexing, an injected search API, bm25 + recency ranking.",
  social: [
    {
      ariaLabel: "View on GitHub",
      href: "https://github.com/mrmartineau/astro-d1-search",
      icon: "github-logo",
      label: "Repo",
    },
    {
      ariaLabel: "View on npm",
      href: "https://www.npmjs.com/package/astro-d1-search",
      icon: "package",
    },
  ],
  title: "astro-d1-search",
  version: "0.0.0",
  versionHref: "/changelog",
  // Floating theme builder + header colour switcher are on by default.
  // Set to `false` to hide them:
  // themeSwitcher: false,
  // miniThemeSwitcher: false,
};
