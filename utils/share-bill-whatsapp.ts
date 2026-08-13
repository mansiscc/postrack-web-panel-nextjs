import { formatCurrency } from "@/utils/currency";
import { formatDateTime } from "@/utils/date";

export type WhatsAppBillShareInput = {
  businessName?: string | null;
  billNumber?: string | null;
  createdAt: string;
  customerName: string;
  customerPhone?: string | null;
  items: Array<{
    productName: string;
    quantity: number;
    rowTotal: number;
  }>;
  otherItemsAmount?: number;
  totalPayable: number;
  receivedAmount: number;
  paymentMode: string;
  status?: string | null;
};

/** Opens WhatsApp Web/app with a text receipt (same pattern as receipt page). */
export function shareBillOnWhatsApp(input: WhatsAppBillShareInput) {
  const lines = [
    input.businessName?.trim() || "POSTrack Receipt",
    input.billNumber ? `Bill: ${input.billNumber}` : null,
    `Date: ${formatDateTime(input.createdAt)}`,
    `Customer: ${input.customerName}${
      input.customerPhone ? ` (${input.customerPhone})` : ""
    }`,
    "",
    ...input.items.map(
      (item) =>
        `${item.productName} x${item.quantity} = ${formatCurrency(item.rowTotal)}`,
    ),
    input.otherItemsAmount && input.otherItemsAmount > 0
      ? `Other items = ${formatCurrency(input.otherItemsAmount)}`
      : null,
    "",
    `Total: ${formatCurrency(input.totalPayable)}`,
    `Received: ${formatCurrency(input.receivedAmount)}`,
    `Payment: ${input.paymentMode}`,
    input.status ? `Status: ${input.status}` : null,
  ].filter(Boolean);

  const text = encodeURIComponent(lines.join("\n"));
  const digits = (input.customerPhone ?? "").replace(/\D/g, "");
  const url = digits
    ? `https://wa.me/${digits}?text=${text}`
    : `https://wa.me/?text=${text}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
