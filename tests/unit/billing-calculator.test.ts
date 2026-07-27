import { describe, expect, it } from "vitest";

import {
  calculateBillingTotals,
  calculateDiscountAmount,
  calculateRefundPayableNow,
  calculateRemainingDue,
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

describe("calculateRefundPayableNow", () => {
  it("refunds nothing when bill was unpaid", () => {
    expect(
      calculateRefundPayableNow({
        totalPayable: 1000,
        receivedAmount: 0,
        previousReturnedAmount: 0,
        thisReturnAmount: 400,
        alreadyRefunded: 0,
      }),
    ).toBe(0);
  });

  it("refunds overpayment after full return on paid bill", () => {
    expect(
      calculateRefundPayableNow({
        totalPayable: 1000,
        receivedAmount: 1000,
        previousReturnedAmount: 0,
        thisReturnAmount: 1000,
        alreadyRefunded: 0,
      }),
    ).toBe(1000);
  });

  it("refunds only overpayment on partial pay", () => {
    expect(
      calculateRefundPayableNow({
        totalPayable: 1000,
        receivedAmount: 400,
        previousReturnedAmount: 0,
        thisReturnAmount: 600,
        alreadyRefunded: 0,
      }),
    ).toBe(0);
  });

  it("caps second return by already refunded amount", () => {
    expect(
      calculateRefundPayableNow({
        totalPayable: 1000,
        receivedAmount: 1000,
        previousReturnedAmount: 400,
        thisReturnAmount: 400,
        alreadyRefunded: 400,
      }),
    ).toBe(400);
  });
});

describe("calculateRemainingDue", () => {
  it("computes due after returns", () => {
    expect(
      calculateRemainingDue({
        totalPayable: 1000,
        totalReturnedAmount: 200,
        receivedAmount: 500,
      }),
    ).toBe(300);
  });
});
