import { describe, expect, test } from "bun:test";

import { DEFAULT_RANKING, type D1Like, searchIndex, toFtsQuery } from "./core";

/** Records the SQL and bindings a `searchIndex` call would send to D1. */
function fakeDb(results: unknown[] = []) {
  const calls: { sql: string; bindings: (string | number)[] }[] = [];
  const db: D1Like = {
    prepare(sql) {
      return {
        bind(...bindings) {
          calls.push({ sql, bindings });
          return { all: async () => ({ results: results as never[] }) };
        },
      };
    },
  };
  return { db, calls };
}

describe("toFtsQuery", () => {
  test("quotes every term and prefix-matches the last one", () => {
    expect(toFtsQuery("css grid")).toBe('"css" "grid"*');
  });

  test("a single term is a prefix match, for search-as-you-type", () => {
    expect(toFtsQuery("gri")).toBe('"gri"*');
  });

  test("neutralises FTS5 operators by quoting them as literal terms", () => {
    expect(toFtsQuery("cats OR dogs")).toBe('"cats" "OR" "dogs"*');
    expect(toFtsQuery("NEAR(a b) -c")).toBe('"NEAR(a" "b)" "-c"*');
  });

  test("strips quote characters that would break out of a quoted term", () => {
    expect(toFtsQuery('a" OR "b')).toBe('"a" "OR" "b"*');
  });

  test("treats control characters as separators so a NUL can't unterminate a term", () => {
    expect(toFtsQuery("ab\u0000cd")).toBe('"ab" "cd"*');
    expect(toFtsQuery("\u0000")).toBe('""');
  });

  test("drops punctuation-only terms so the prefix stays on the last real term", () => {
    expect(toFtsQuery("gri !")).toBe('"gri"*');
    expect(toFtsQuery("css && grid")).toBe('"css" "grid"*');
    expect(toFtsQuery("! -- &&")).toBe('""');
  });

  test("caps the number of terms", () => {
    expect(toFtsQuery("a b c d e f g h i j", 3)).toBe('"a" "b" "c"*');
  });

  test("empty input produces a query that matches nothing", () => {
    expect(toFtsQuery("   ")).toBe('""');
  });
});

describe("searchIndex", () => {
  test("binds the match expression and paging values, never interpolating them", async () => {
    const { db, calls } = fakeDb();

    await searchIndex(db, { query: "css grid", limit: 5, offset: 10 });

    const call = calls[0];
    expect(call?.bindings).toEqual(['"css" "grid"*', 5, 10]);
    expect(call?.sql).toContain("MATCH ?1");
    expect(call?.sql).toContain("LIMIT ?2 OFFSET ?3");
    expect(call?.sql).not.toContain("css");
  });

  test("appends a bound type filter and renumbers the paging params", async () => {
    const { db, calls } = fakeDb();

    await searchIndex(db, { query: "grid", type: "note" });

    const call = calls[0];
    expect(call?.bindings).toEqual(['"grid"*', "note", 10, 0]);
    expect(call?.sql).toContain("AND type = ?2");
    expect(call?.sql).toContain("LIMIT ?3 OFFSET ?4");
  });

  test("uses the configured bm25 weights and snippet size", async () => {
    const { db, calls } = fakeDb();

    await searchIndex(db, { query: "grid" }, { ...DEFAULT_RANKING, snippetTokens: 12 });

    expect(calls[0]?.sql).toContain("bm25(search_index, 10.0, 5.0, 1.0, 3.0)");
    expect(calls[0]?.sql).toContain("'<mark>', '</mark>', '…', 12");
  });

  test("orders by score ascending, because bm25 is lower-is-better", async () => {
    const { db, calls } = fakeDb();

    await searchIndex(db, { query: "grid" });

    expect(calls[0]?.sql).toContain("ORDER BY score");
    expect(calls[0]?.sql).not.toContain("ORDER BY score DESC");
  });

  test("recency boost of 0 leaves relevance unscaled", async () => {
    const { db, calls } = fakeDb();

    await searchIndex(
      db,
      { query: "grid" },
      { ...DEFAULT_RANKING, recency: { boost: 0, windowDays: 1095 } },
    );

    expect(calls[0]?.sql).toContain("(1.0 + 0 *");
  });

  test("returns the rows D1 gives back", async () => {
    const row = { title: "CSS Grid", url: "/notes/css-grid", type: "note", score: -7.7 };
    const { db } = fakeDb([row]);

    const results = await searchIndex(db, { query: "grid" });

    expect(results).toEqual([row] as never);
  });
});
