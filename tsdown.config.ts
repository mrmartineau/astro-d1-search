import { defineConfig } from "tsdown";

export default defineConfig({
  // Four entries, not one bundle: `route.ts` must stay a standalone module on
  // disk because Astro's `injectRoute` takes a *file path*, and `core`/
  // `indexer` are separate subpath exports so a consumer's Worker bundle never
  // pulls in the Node-only indexer.
  entry: ["src/index.ts", "src/core.ts", "src/indexer.ts", "src/route.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "node",
  dts: true,
  sourcemap: true,
  clean: true,
  outExtensions: () => ({ js: ".mjs", dts: ".d.mts" }),
  deps: {
    // Resolved by the integration's own Vite plugin inside the consuming Astro
    // project — it does not exist at build time here.
    neverBundle: ["virtual:astro-d1-search-config"],
  },
});
