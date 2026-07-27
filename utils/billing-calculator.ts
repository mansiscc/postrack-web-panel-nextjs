export type DiscountType = "AMOUNT" | "PERCENT";

export type CartLineInput = {
  unitPrice: number;
  quantity: number;
};

export type BillingTotalsInput = {
  items: CartLineInput[];
  otherItemsAmount?: number;
  discountType?: DiscountType | null;
  discountValue?: number;
  receivedAmount?: number;
};

export type BillingTotals = {
  subtotal: number;
  otherItemsAmount: number;
  discountAmount: number;
  totalPayable: number;
  receivedAmount: number;
  changeAmount: number;
  remainingAmount: number;
  status: "PENDING" | "PARTIALLY_PAID" | "PAID";
};

export function calculateSubtotal(items: CartLineInput[]): number {
  return items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
}

export function calculateDiscountAmount(
  subtotal: number,
  otherItemsAmount: number,
  discountType: DiscountType | null | undefined,
  discountValue: number | undefined,
): number {
  const base = subtotal + otherItemsAmount;
  if (!discountType || !discountValue || discountValue <= 0) return 0;
  if (discountType === "PERCENT") {
    return Math.min(base, (base * discountValue) / 100);
  }
  return Math.min(base, discountValue);
}

export function calculateBillStatus(
  totalPayable: number,
  receivedAmount: number,
): BillingTotals["status"] {
  if (receivedAmount >= totalPayable) return "PAID";
  if (receivedAmount > 0) return "PARTIALLY_PAID";
  return "PENDING";
}

export function calculateBillingTotals(
  input: BillingTotalsInput,
): BillingTotals {
  const subtotal = calculateSubtotal(input.items);
  const otherItemsAmount = input.otherItemsAmount ?? 0;
  const discountAmount = calculateDiscountAmount(
    subtotal,
    otherItemsAmount,
    input.discountType,
    input.discountValue,
  );
  const totalPayable = Math.max(
    subtotal + otherItemsAmount - discountAmount,
    0,
  );
  const receivedAmount = Math.max(input.receivedAmount ?? 0, 0);
  const changeAmount = Math.max(receivedAmount - totalPayable, 0);
  const remainingAmount = Math.max(totalPayable - receivedAmount, 0);

  return {
    subtotal,
    otherItemsAmount,
    discountAmount,
    totalPayable,
    receivedAmount,
    changeAmount,
    remainingAmount,
    status: calculateBillStatus(totalPayable, receivedAmount),
  };
}

export function splitPaymentAmounts(
  paymentMode: "Cash" | "UPI" | "Card" | "Mixed",
  receivedAmount: number,
  mixedCashAmount?: number,
  mixedUpiAmount?: number,
): { cashAmount: number; onlineAmount: number } {
  if (paymentMode === "Cash") {
    return { cashAmount: receivedAmount, onlineAmount: 0 };
  }
  if (paymentMode === "Mixed") {
    return {
      cashAmount: mixedCashAmount ?? 0,
      onlineAmount: mixedUpiAmount ?? 0,
    };
  }
  return { cashAmount: 0, onlineAmount: receivedAmount };
}

/**
 * Android ProcessBillReturnUseCase refund rule:
 * refund only overpayment vs net payable after returns (never refund unpaid dues).
 */
export function calculateRefundPayableNow(input: {
  totalPayable: number;
  receivedAmount: number;
  previousReturnedAmount: number;
  thisReturnAmount: number;
  alreadyRefunded: number;
}): number {
  const netPayableAfterThisReturn =
    input.totalPayable -
    input.previousReturnedAmount -
    input.thisReturnAmount;
  const totalRefundDue = Math.max(
    input.receivedAmount - netPayableAfterThisReturn,
    0,
  );
  return Number(
    Math.min(
      Math.max(totalRefundDue - input.alreadyRefunded, 0),
      input.thisReturnAmount,
    ).toFixed(2),
  );
}

/** Remaining due after returns: (payable − returned) − received. */
export function calculateRemainingDue(input: {
  totalPayable: number;
  totalReturnedAmount: number;
  receivedAmount: number;
}): number {
  const netPayable = input.totalPayable - input.totalReturnedAmount;
  return Number((netPayable - input.receivedAmount).toFixed(2));
}
