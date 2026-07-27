import { describe, expect, it } from "vitest";

import { isSystemAccountingCategory } from "@/utils/system-accounting-categories";

describe("isSystemAccountingCategory", () => {
  it("matches Sales income", () => {
    expect(isSystemAccountingCategory("Sales", "income")).toBe(true);
    expect(isSystemAccountingCategory("sales", "income")).toBe(true);
  });

  it("matches Purchase and Sales Return expense", () => {
    expect(isSystemAccountingCategory("Purchase", "expense")).toBe(true);
    expect(isSystemAccountingCategory("Sales Return", "expense")).toBe(true);
  });

  it("rejects wrong type or custom names", () => {
    expect(isSystemAccountingCategory("Sales", "expense")).toBe(false);
    expect(isSystemAccountingCategory("Manual Income", "income")).toBe(false);
  });
});
