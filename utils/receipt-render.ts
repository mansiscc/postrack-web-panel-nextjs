import {
  shouldShowReceiptLogo,
  type ReceiptPreviewData,
} from "@/utils/receipt-preview-data";
import {
  buildReceiptText,
  receiptLineStyle,
  type ReceiptFormatterInput,
} from "@/utils/receipt-text-formatter";
import type { ReceiptPaperWidth } from "@/utils/print-settings";
import { getReceiptPrintLayout } from "@/utils/receipt-print-layout";

export function toReceiptFormatterInput(
  data: ReceiptPreviewData,
): ReceiptFormatterInput {
  return {
    businessName: data.businessName?.trim() || "",
    businessAddress: data.businessAddress,
    businessPhone: data.businessPhone,
    businessGstin: data.businessGstin,
    billNumber: data.billNumber?.trim() || "—",
    createdAt: data.createdAt,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    items: data.items.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      rowTotal: item.rowTotal,
      mrp: item.mrp,
    })),
    subtotal: data.subtotal,
    otherItemsAmount: data.otherItemsAmount,
    discountAmount: data.discountAmount,
    totalAmount: data.totalPayable,
    paidAmount: data.receivedAmount,
    receiptFooter: data.receiptFooter,
  };
}

export function buildReceiptLines(
  data: ReceiptPreviewData,
  paperWidth: ReceiptPaperWidth,
): string[] {
  return buildReceiptText(toReceiptFormatterInput(data), paperWidth).split(
    "\n",
  );
}

/**
 * Android PDF/thermal uses `Typeface.MONOSPACE` (Droid Sans Mono on device).
 * Web uses Roboto Mono from Google Fonts CDN — same Android monospace family,
 * no local font files.
 */
export const RECEIPT_MONO_FONT =
  '"Roboto Mono", "Droid Sans Mono", "Courier New", monospace';

/** Google Fonts stylesheet for receipt monospace (400 + 700). */
export const RECEIPT_MONO_FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap";

const RECEIPT_MONO_LINK_ID = "postrack-receipt-roboto-mono";

/** Ensure Roboto Mono is available for on-screen receipt preview. */
export function ensureReceiptMonoFontLoaded() {
  if (typeof document === "undefined") return;
  if (document.getElementById(RECEIPT_MONO_LINK_ID)) return;
  const link = document.createElement("link");
  link.id = RECEIPT_MONO_LINK_ID;
  link.rel = "stylesheet";
  link.href = RECEIPT_MONO_FONT_STYLESHEET;
  document.head.appendChild(link);
}

/** Pad/truncate a receipt line to the exact thermal width. */
export function padReceiptLine(line: string, charactersPerLine: number): string {
  if (line.length >= charactersPerLine) {
    return line.slice(0, charactersPerLine);
  }
  return line.padEnd(charactersPerLine, " ");
}

/** Preserve column padding even if a parent collapses normal spaces. */
export function toReceiptDisplayText(lines: string[]): string {
  return lines
    .map((line) => (line.length ? line : " "))
    .join("\n")
    .replaceAll(" ", "\u00A0");
}

export function toReceiptNbspLine(
  line: string,
  charactersPerLine: number,
): string {
  return padReceiptLine(line, charactersPerLine).replaceAll(" ", "\u00A0");
}

export function getReceiptRenderMeta(data: ReceiptPreviewData) {
  return {
    showLogo: shouldShowReceiptLogo(data),
    logoSrc: data.logoUrl?.trim() || "",
    businessName: data.businessName?.trim() || "",
  };
}

export function getReceiptLineClassName(
  line: string,
  businessName: string,
): string {
  return receiptLineStyle(line, businessName);
}

export function getReceiptPreviewShellStyle(paperWidth: ReceiptPaperWidth) {
  const layout = getReceiptPrintLayout(paperWidth);
  return {
    layout,
    outer: {
      width: "fit-content" as const,
      maxWidth: "100%" as const,
      marginLeft: "auto",
      marginRight: "auto",
      padding: "12px 8px",
    },
  };
}
