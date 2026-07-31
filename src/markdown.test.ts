import { describe, expect, test } from "bun:test";

import { markdownToPlainText, sqlEscape } from "./markdown";

describe("markdownToPlainText", () => {
  test("strips markdown syntax but keeps the words", () => {
    const text = markdownToPlainText(
      [
        "# Heading",
        "",
        "Some **bold** and *italic* text with `inline code`.",
        "",
        "> A quote",
      ].join("\n"),
    );

    expect(text).toBe("Heading Some bold and italic text with inline code. A quote");
  });

  test("keeps code inside fences so code is searchable", () => {
    const text = markdownToPlainText(["```ts", "const answer = 42;", "```"].join("\n"));

    expect(text).toBe("const answer = 42;");
  });

  test("keeps link and image text, drops the URLs", () => {
    const text = markdownToPlainText(
      "See [the docs](https://example.com/docs) and ![a diagram](./diagram.png)",
    );

    expect(text).toBe("See the docs and a diagram");
    expect(text).not.toContain("example.com");
  });

  test("drops MDX imports/exports and HTML or JSX tags", () => {
    const text = markdownToPlainText(
      [
        'import Demo from "../Demo.astro";',
        "export const order = 1;",
        "",
        "<Demo>Visible</Demo>",
      ].join("\n"),
    );

    expect(text).toBe("Visible");
  });

  test("drops horizontal rules and collapses whitespace", () => {
    expect(markdownToPlainText("one\n\n---\n\ntwo")).toBe("one two");
  });
});

describe("sqlEscape", () => {
  test("doubles single quotes so the value stays inside its literal", () => {
    expect(sqlEscape("it's fine")).toBe("it''s fine");
    expect(sqlEscape("'); DROP TABLE search_index;--")).toBe("''); DROP TABLE search_index;--");
  });

  test("leaves quote-free values untouched", () => {
    expect(sqlEscape('double "quotes" and \\ backslash')).toBe('double "quotes" and \\ backslash');
  });
});
