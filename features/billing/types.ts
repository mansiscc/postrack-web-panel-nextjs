export type CartItem = {
  id: string;
  productId: string;
  productName: string;
  barcode?: string | null;
  unitPrice: number;
  /** Snapshot MRP for “Saved on MRP” receipt line (Android parity). */
  mrp?: number | null;
  quantity: number;
  batchId?: string | null;
  batchName?: string | null;
  maxQuantity?: number;
  isManual?: boolean;
};

export type BillingCartState = {
  items: CartItem[];
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  paymentMode: "Cash" | "UPI" | "Card" | "Mixed";
  mixedCashAmount: number;
  mixedUpiAmount: number;
  otherItemsAmount: number;
  discountType: "AMOUNT" | "PERCENT" | null;
  discountValue: number;
  receivedAmount: number;
  selectedAccountId: string;
};

export const emptyCartState = (accountId = ""): BillingCartState => ({
  items: [],
  customerId: null,
  customerName: "",
  customerPhone: "",
  paymentMode: "Cash",
  mixedCashAmount: 0,
  mixedUpiAmount: 0,
  otherItemsAmount: 0,
  discountType: "AMOUNT",
  discountValue: 0,
  receivedAmount: 0,
  selectedAccountId: accountId,
});
