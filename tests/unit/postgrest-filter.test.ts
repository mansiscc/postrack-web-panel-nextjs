import { describe, expect, it } from "vitest";

import {
  sanitizePostgrestSearch,
  toIlikePattern,
} from "@/utils/postgrest-filter";

describe("sanitizePostgrestSearch", () => {
  it("strips PostgREST metacharacters", () => {
    expect(sanitizePostgrestSearch("a,b(c)%")).toBe("abc\\%");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(sanitizePostgrestSearch("   ")).toBe("");
  });
});

describe("toIlikePattern", () => {
  it("wraps sanitized term with wildcards", () => {
    expect(toIlikePattern("tea")).toBe("%tea%");
  });
});
