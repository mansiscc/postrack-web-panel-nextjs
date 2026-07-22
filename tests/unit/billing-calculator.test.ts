import { describe, expect, it } from "vitest";

import {
  calculateBillingTotals,
  calculateDiscountAmount,
  calculateSubtotal,
  splitPaymentAmounts,
} from "@/utils/billing-calculator";

describe("calculateSubtotal", () => {
  it("sums line totals", () => {
    expect(
      calculateSubtotal([
        { unitPrice: 100, quantity: 2 },
        { unitPrice: 50, quantity: 1 },
      ]),
    ).toBe(250);
  });
});

describe("calculateDiscountAmount", () => {
  it("applies percent discount on subtotal plus other items", () => {
    expect(calculateDiscountAmount(1000, 100, "PERCENT", 10)).toBe(110);
  });

  it("caps amount discount at base total", () => {
    expect(calculateDiscountAmount(100, 0, "AMOUNT", 500)).toBe(100);
  });

  it("returns zero when discount is missing", () => {
    expect(calculateDiscountAmount(100, 0, null, 0)).toBe(0);
  });
});

describe("calculateBillingTotals", () => {
  it("computes payable, change, and paid status", () => {
    const totals = calculateBillingTotals({
      items: [{ unitPrice: 100, quantity: 2 }],
      otherItemsAmount: 50,
      discountType: "AMOUNT",
      discountValue: 50,
      receivedAmount: 300,
    });

    expect(totals.subtotal).toBe(200);
    expect(totals.totalPayable).toBe(200);
    expect(totals.changeAmount).toBe(100);
    expect(totals.status).toBe("PAID");
  });

  it("marks partial payment correctly", () => {
    const totals = calculateBillingTotals({
      items: [{ unitPrice: 200, quantity: 1 }],
      receivedAmount: 50,
    });

    expect(totals.status).toBe("PARTIALLY_PAID");
    expect(totals.remainingAmount).toBe(150);
  });
});

describe("splitPaymentAmounts", () => {
  it("splits cash and mixed payments", () => {
    expect(splitPaymentAmounts("Cash", 500)).toEqual({
      cashAmount: 500,
      onlineAmount: 0,
    });
    expect(splitPaymentAmounts("Mixed", 500, 200, 300)).toEqual({
      cashAmount: 200,
      onlineAmount: 300,
    });
    expect(splitPaymentAmounts("UPI", 500)).toEqual({
      cashAmount: 0,
      onlineAmount: 500,
    });
  });
});
