import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { gatherDocs, SCHEMA_SQL, toSql } from "./indexer";

const doc = {
  title: "CSS Grid",
  description: "Laying things out",
  content: "display: grid;",
  tags: ["css", "layout"],
  url: "/notes/css-grid",
  type: "note",
  date: "2023-01-20",
  emoji: "🍱",
};

describe("toSql", () => {
  test("creates the table if needed, so there is no migration step", () => {
    expect(toSql([doc], "")).toStartWith(SCHEMA_SQL);
    expect(SCHEMA_SQL).toContain("CREATE VIRTUAL TABLE IF NOT EXISTS search_index");
  });

  test("wipes the whole table when no site id is configured", () => {
    expect(toSql([doc], "")).toContain("DELETE FROM search_index;");
  });

  test("scopes the delete to one site so several sites can share a database", () => {
    const sql = toSql([doc], "zander.wtf");

    expect(sql).toContain("DELETE FROM search_index WHERE site = 'zander.wtf';");
    expect(sql).not.toContain("DELETE FROM search_index;");
    expect(sql).toContain("'zander.wtf'");
  });

  test("joins tags into a single searchable column", () => {
    expect(toSql([doc], "")).toContain("'css layout'");
  });

  test("escapes quotes in values and in the site id", () => {
    const sql = toSql([{ ...doc, title: "It's fine" }], "o'brien.dev");

    expect(sql).toContain("'It''s fine'");
    expect(sql).toContain("WHERE site = 'o''brien.dev'");
  });

  test("emits no INSERT at all for an empty document set", () => {
    expect(toSql([], "")).not.toContain("INSERT INTO");
  });

  test("splits large document sets into several INSERT statements", () => {
    const big = Array.from({ length: 60 }, (_, i) => ({
      ...doc,
      url: `/notes/${i}`,
      content: "x".repeat(5000),
    }));

    const inserts = toSql(big, "").match(/INSERT INTO search_index/g) ?? [];
    expect(inserts.length).toBeGreaterThan(1);
  });
});

describe("gatherDocs", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "astro-d1-search-"));
    const blog = join(root, "blog");
    await mkdir(join(blog, "2024-hello"), { recursive: true });
    await mkdir(join(blog, "Templates"), { recursive: true });
    await mkdir(join(root, "pages"), { recursive: true });

    // <dir>/index.md takes its slug from the directory, like Astro does
    await writeFile(
      join(blog, "2024-hello", "index.md"),
      "---\ntitle: Hello\nsubtitle: A greeting\ntags:\n  - intro\ndate: 2024-03-01\n---\n\n# Hi\n\nSome **body** text.\n",
    );
    // frontmatter `slug` wins over the file name
    await writeFile(
      join(blog, "second.md"),
      "---\ntitle: Second\nslug: custom-slug\n---\n\nBody.\n",
    );
    // untitled documents are skipped entirely
    await writeFile(join(blog, "untitled.md"), "---\ndate: 2024-01-01\n---\n\nNo title here.\n");
    // skipDirs directories are never scanned
    await writeFile(join(blog, "Templates", "tpl.md"), "---\ntitle: Template\n---\n\nSkip me.\n");
    await writeFile(join(root, "pages", "about.mdx"), "---\ntitle: About\n---\n\nAbout me.\n");
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("reads frontmatter, resolves slugs and flattens the body", async () => {
    const docs = await gatherDocs({
      database: "test",
      sources: [{ dir: join(root, "blog"), type: "blog", url: "/blog/:slug" }],
    });

    const hello = docs.find((d) => d.title === "Hello");
    expect(hello?.url).toBe("/blog/2024-hello");
    expect(hello?.description).toBe("A greeting");
    expect(hello?.tags).toEqual(["intro"]);
    expect(hello?.date).toBe("2024-03-01");
    expect(hello?.content).toBe("Hi Some body text.");

    expect(docs.find((d) => d.title === "Second")?.url).toBe("/blog/custom-slug");
  });

  test("skips untitled documents and skipDirs directories", async () => {
    const docs = await gatherDocs({
      database: "test",
      sources: [{ dir: join(root, "blog"), type: "blog", url: "/blog/:slug" }],
    });

    expect(docs.map((d) => d.title).sort()).toEqual(["Hello", "Second"]);
  });

  test("a URL pattern without :slug maps every document to one page", async () => {
    const docs = await gatherDocs({
      database: "test",
      sources: [{ dir: join(root, "blog"), type: "blog", url: "/blog" }],
    });

    expect(docs.every((d) => d.url === "/blog")).toBe(true);
  });

  test("indexes explicit file lists and truncates long content", async () => {
    const docs = await gatherDocs({
      database: "test",
      maxContentLength: 5,
      sources: [{ files: [join(root, "pages", "about.mdx")], type: "page", url: "/:slug" }],
    });

    expect(docs).toHaveLength(1);
    expect(docs[0]?.url).toBe("/about");
    expect(docs[0]?.type).toBe("page");
    expect(docs[0]?.content).toBe("About");
  });
});
