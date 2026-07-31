import { describe, expect, test } from "bun:test";

import { resolveConfig } from "./config";

const minimal = {
  database: "my-search",
  sources: [{ dir: "src/content/blog", type: "blog", url: "/blog/:slug" }],
};

describe("resolveConfig", () => {
  test("applies documented defaults", () => {
    const config = resolveConfig(minimal);

    expect(config.binding).toBe("SEARCH_DB");
    expect(config.site).toBe("");
    expect(config.apiRoute).toBe("/api/search");
    expect(config.cors).toBe(true);
    expect(config.cacheMaxAge).toBe(300);
    expect(config.maxLimit).toBe(25);
    expect(config.maxOffset).toBe(200);
    expect(config.maxQueryLength).toBe(100);
    expect(config.weights).toEqual({
      title: 10,
      description: 5,
      content: 1,
      tags: 3,
    });
    expect(config.recency).toEqual({ boost: 0.35, windowDays: 1095 });
    expect(config.maxTerms).toBe(8);
    expect(config.snippetTokens).toBe(24);
    expect(config.maxContentLength).toBe(8000);
  });

  test("merges partial weights and recency without dropping siblings", () => {
    const config = resolveConfig({ ...minimal, weights: { title: 20 }, recency: { boost: 0 } });

    expect(config.weights).toEqual({ title: 20, description: 5, content: 1, tags: 3 });
    expect(config.recency).toEqual({ boost: 0, windowDays: 1095 });
  });

  test("normalises sources and de-duplicates types", () => {
    const config = resolveConfig({
      database: "my-search",
      sources: [
        { dir: "a", type: "note", url: "/notes/:slug" },
        { files: ["b.md"], type: "note", url: "/notes/:slug" },
        { dir: "c", type: "page", url: "/:slug", skipDirs: ["drafts"] },
      ],
    });

    expect(config.types).toEqual(["note", "page"]);
    expect(config.sources[0]?.files).toEqual([]);
    expect(config.sources[1]?.dir).toBe("");
    expect(config.sources[0]?.skipDirs).toEqual(["Templates"]);
    expect(config.sources[2]?.skipDirs).toEqual(["drafts"]);
  });

  test("apiRoute can be disabled but is not clobbered by the default", () => {
    expect(resolveConfig({ ...minimal, apiRoute: false }).apiRoute).toBe(false);
    expect(resolveConfig({ ...minimal, apiRoute: "/search.json" }).apiRoute).toBe("/search.json");
  });

  test("rejects invalid configuration", () => {
    // @ts-expect-error deliberately missing `database`
    expect(() => resolveConfig({ sources: minimal.sources })).toThrow(
      /`database` option is required/,
    );
    expect(() => resolveConfig({ database: "x", sources: [] })).toThrow(
      /at least one entry in `sources`/,
    );
    expect(() =>
      resolveConfig({ database: "x", sources: [{ type: "blog", url: "/b/:slug" }] }),
    ).toThrow(/needs either `dir` or `files`/);
  });
});
