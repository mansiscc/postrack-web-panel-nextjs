import { describe, expect, it } from "vitest";

import { escapeCsvCell, rowsToCsv } from "@/utils/csv";

describe("escapeCsvCell", () => {
  it("quotes values with commas and escapes quotes", () => {
    expect(escapeCsvCell('Say "hello"')).toBe('"Say ""hello"""');
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
  });

  it("returns plain strings unchanged", () => {
    expect(escapeCsvCell("plain")).toBe("plain");
    expect(escapeCsvCell(null)).toBe("");
  });
});

describe("rowsToCsv", () => {
  it("builds a csv with header row", () => {
    const csv = rowsToCsv(
      ["Name", "Amount"],
      [
        ["Widget", 10],
        ['Big, box', 20],
      ],
    );

    expect(csv).toBe(
      ['Name,Amount', 'Widget,10', '"Big, box",20'].join("\n"),
    );
  });
});
