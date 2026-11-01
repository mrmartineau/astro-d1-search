/**
 * Search oracle. See intent/search.md for the rules this checks.
 *
 * Unlike core.test.ts (which asserts on SQL text against a fake D1), this
 * runs the real pipeline against real SQLite FTS5: docs -> toSql() (the
 * indexer's own output) -> bun:sqlite -> searchIndex(). fast-check generates
 * corpora and queries; each property compares the result against a small
 * independent model of what should happen. A failure prints a shrunk
 * counterexample. If a change breaks a rule, either fix the change or revise
 * the rule in intent/search.md first, then update the property here.
 */
import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import fc from "fast-check";

import { DEFAULT_RANKING, type D1Like, searchIndex, toFtsQuery } from "./core";
import { toSql } from "./indexer";

type Doc = Parameters<typeof toSql>[0][number];

// Small vocabulary so generated queries actually hit generated docs.
// Porter stemming is on, so keep words already in stem form to keep the
// model simple: the model doesn't stem, so stem-variant words would make it
// disagree with FTS5 for reasons that aren't bugs.
const WORDS = ["grid", "flex", "astro", "worker", "cache", "font", "token", "query"];
const TYPES = ["post", "note", "link"];

const word = fc.constantFrom(...WORDS);
const text = fc.array(word, { minLength: 0, maxLength: 6 }).map((w) => w.join(" "));

const isoDaysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

const doc: fc.Arbitrary<Doc> = fc.record({
  title: fc.array(word, { minLength: 1, maxLength: 3 }).map((w) => w.join(" ")),
  description: text,
  content: text,
  tags: fc.array(word, { maxLength: 2 }),
  url: fc.uuid().map((id) => `/p/${id}`),
  type: fc.constantFrom(...TYPES),
  date: fc.oneof(fc.constant(""), fc.integer({ min: 0, max: 3000 }).map(isoDaysAgo)),
  emoji: fc.constant(""),
});

const corpus = fc.uniqueArray(doc, { minLength: 1, maxLength: 25, selector: (d) => d.url });
// Mostly real words, with punctuation-only noise mixed in (R1: ignored).
// The last real word is sometimes truncated, so prefix-vs-exact matters.
const noise = fc.constantFrom("!", "&&", "-", "--", "*", "()");
const query = fc
  .tuple(
    fc.array(fc.oneof({ arbitrary: word, weight: 4 }, { arbitrary: noise, weight: 1 }), {
      minLength: 1,
      maxLength: 4,
    }),
    fc.integer({ min: 2, max: 6 }),
  )
  .map(([terms, keep]) => {
    for (let i = terms.length - 1; i >= 0; i--) {
      if (WORDS.includes(terms[i]!)) {
        terms[i] = terms[i]!.slice(0, keep);
        break;
      }
    }
    return terms.join(" ");
  });

/** A real FTS5 database loaded with exactly the SQL the indexer would push. */
function loadDb(docs: Doc[]): { db: D1Like; close: () => void } {
  const sqlite = new Database(":memory:");
  sqlite.exec(toSql(docs, "test"));
  const db: D1Like = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            all: async <T>() => ({ results: sqlite.query(sql).all(...values) as T[] }),
          };
        },
      };
    },
  };
  return { db, close: () => sqlite.close() };
}

// ---------- the model ----------

const tokens = (d: Doc) =>
  [d.title, d.description, d.content, d.tags.join(" ")].join(" ").split(/\s+/).filter(Boolean);

/**
 * Every term must appear; the last term is a prefix match. Terms with no
 * letters or digits are ignored before the maxTerms cap. No real terms at
 * all matches nothing.
 */
function modelMatches(d: Doc, q: string): boolean {
  const terms = q
    .split(/\s+/)
    .filter((t) => /[\p{L}\p{N}]/u.test(t))
    .slice(0, DEFAULT_RANKING.maxTerms);
  if (terms.length === 0) return false;
  const toks = tokens(d);
  return terms.every((t, i) =>
    i === terms.length - 1 ? toks.some((k) => k.startsWith(t)) : toks.includes(t),
  );
}

const run = { numRuns: 200 };

describe("search oracle (real FTS5)", () => {
  test("R1 recall/precision: results are exactly the docs the model says match", async () => {
    await fc.assert(
      fc.asyncProperty(corpus, query, async (docs, q) => {
        const { db, close } = loadDb(docs);
        try {
          const got = await searchIndex(db, { query: q, limit: 1000 });
          const want = docs.filter((d) => modelMatches(d, q)).map((d) => d.url);
          expect(got.map((r) => r.url).sort()).toEqual(want.sort());
        } finally {
          close();
        }
      }),
      run,
    );
  });

  test("R2 type filter only ever returns that type, and loses nothing of it", async () => {
    await fc.assert(
      fc.asyncProperty(corpus, query, fc.constantFrom(...TYPES), async (docs, q, type) => {
        const { db, close } = loadDb(docs);
        try {
          const all = await searchIndex(db, { query: q, limit: 1000 });
          const filtered = await searchIndex(db, { query: q, type, limit: 1000 });
          expect(filtered.every((r) => r.type === type)).toBe(true);
          expect(filtered.map((r) => r.url).sort()).toEqual(
            all
              .filter((r) => r.type === type)
              .map((r) => r.url)
              .sort(),
          );
        } finally {
          close();
        }
      }),
      run,
    );
  });

  test("R3 best-first, ties broken by url, and pages tile the full list exactly", async () => {
    await fc.assert(
      fc.asyncProperty(corpus, query, fc.integer({ min: 1, max: 5 }), async (docs, q, size) => {
        const { db, close } = loadDb(docs);
        try {
          const all = await searchIndex(db, { query: q, limit: 1000 });
          for (let i = 1; i < all.length; i++) {
            const [prev, cur] = [all[i - 1]!, all[i]!];
            expect(cur.score).toBeGreaterThanOrEqual(prev.score);
            if (cur.score === prev.score) expect(cur.url > prev.url).toBe(true);
          }
          const paged: string[] = [];
          for (let offset = 0; offset < all.length; offset += size) {
            const page = await searchIndex(db, { query: q, limit: size, offset });
            expect(page.length).toBeLessThanOrEqual(size);
            paged.push(...page.map((r) => r.url));
          }
          // Deterministic order, so pages concatenate to exactly the full list.
          expect(paged).toEqual(all.map((r) => r.url));
        } finally {
          close();
        }
      }),
      run,
    );
  });

  test("R4 recency: of two otherwise identical docs, the newer one ranks first", async () => {
    await fc.assert(
      fc.asyncProperty(
        doc,
        fc.integer({ min: 0, max: DEFAULT_RANKING.recency.windowDays - 30 }),
        fc.integer({ min: 30, max: 2000 }),
        async (base, newerAge, gap) => {
          const newer = { ...base, url: "/newer", date: isoDaysAgo(newerAge) };
          const older = { ...base, url: "/older", date: isoDaysAgo(newerAge + gap) };
          const q = base.title.split(" ")[0]!;
          const { db, close } = loadDb([older, newer]);
          try {
            const got = await searchIndex(db, { query: q });
            expect(got.map((r) => r.url)).toEqual(["/newer", "/older"]);
          } finally {
            close();
          }
        },
      ),
      run,
    );
  });

  test("R4 recency: a dated doc in the window beats an identical undated one", async () => {
    await fc.assert(
      fc.asyncProperty(
        doc,
        fc.integer({ min: 0, max: DEFAULT_RANKING.recency.windowDays - 30 }),
        async (base, age) => {
          const dated = { ...base, url: "/dated", date: isoDaysAgo(age) };
          const undated = { ...base, url: "/undated", date: "" };
          const q = base.title.split(" ")[0]!;
          const { db, close } = loadDb([undated, dated]);
          try {
            const got = await searchIndex(db, { query: q });
            expect(got.map((r) => r.url)).toEqual(["/dated", "/undated"]);
          } finally {
            close();
          }
        },
      ),
      run,
    );
  });

  test("R5 hostile input never errors, never escapes quoting, never matches everything", async () => {
    await fc.assert(
      fc.asyncProperty(corpus, fc.string({ unit: "binary", maxLength: 40 }), async (docs, q) => {
        const { db, close } = loadDb(docs);
        try {
          // Must not throw: an FTS5 syntax error here means input reached
          // MATCH unquoted.
          const got = await searchIndex(db, { query: q, limit: 1000 });
          // Every term in the generated MATCH is a quoted literal.
          expect(toFtsQuery(q)).toMatch(/^("[^"]*"\*?)( "[^"]*"\*?)*$/);
          // A query of nothing-but-noise is not a wildcard over the corpus.
          if (toFtsQuery(q) === '""') expect(got).toEqual([]);
        } finally {
          close();
        }
      }),
      { numRuns: 500 },
    );
  });
});
