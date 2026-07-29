import { describe, expect, test } from "bun:test";

import { hello } from "./index.js";

describe("hello", () => {
  test("returns a greeting with the provided name", () => {
    expect(hello("Bun")).toBe("Hello, Bun!");
  });
});
