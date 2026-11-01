/** Structural checks for intent/budgets.md. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (file: string) => readFileSync(join(import.meta.dir, file), "utf-8");

/** Static imports/re-exports, dynamic `import()` and `require()`. */
const importsOf = (source: string) =>
  [
    ...source.matchAll(/^\s*(?:import|export)[^;]*?from\s+["']([^"']+)["']/gms),
    ...source.matchAll(/^\s*import\s+["']([^"']+)["']/gm),
    ...source.matchAll(/\b(?:import|require)\s*\(\s*["'`]([^"'`]+)["'`]/g),
  ].map((m) => m[1]!);

describe("intent/budgets.md", () => {
  const ALLOWED = new Set(["./config", "./core", "astro", "virtual:astro-d1-search-config"]);

  for (const file of ["core.ts", "config.ts", "route.ts"]) {
    test(`B1 ${file} only imports Worker-safe modules`, () => {
      const disallowed = importsOf(read(file)).filter((spec) => !ALLOWED.has(spec));
      expect(disallowed).toEqual([]);
    });
  }

  test("B2 no @cloudflare/workers-types dependency", () => {
    const pkg = JSON.parse(read("../package.json"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    expect(Object.keys(deps)).not.toContain("@cloudflare/workers-types");
  });
});
