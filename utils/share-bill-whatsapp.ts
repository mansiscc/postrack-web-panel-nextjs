/**
 * WhatsApp bill share — mirrors Android `BillWhatsAppShare` main flow:
 * short thank-you caption + receipt PDF (when the browser can share files).
 */

import { format } from "date-fns";

import { formatMoneyForPrint } from "@/utils/receipt-text-formatter";
import { readPrintSettings } from "@/utils/print-settings";
import {
  buildMonospaceReceiptPdf,
  styleReceiptLinesForPdf,
} from "@/utils/receipt-pdf";
import type { ReceiptPreviewData } from "@/utils/receipt-preview-data";
import { buildReceiptLines } from "@/utils/receipt-render";

/** Digits-only international form for wa.me (Android normalizePhoneForWhatsApp). */
export function normalizePhoneForWhatsApp(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  while (digits.length > 10 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/** Android `CurrencyFormatUtils.formatRupee` default (no grouping). */
function formatRupee(amount: number): string {
  if (!Number.isFinite(amount)) return "₹0";
  const sign = amount < 0 ? "-" : "";
  return `${sign}₹${formatMoneyForPrint(Math.abs(amount), false)}`;
}

/**
 * Android `BillWhatsAppShare.buildShortCustomerThankYouMessage`.
 */
export function buildShortCustomerThankYouMessage(input: {
  customerName: string;
  companyName: string;
  billDate: string;
  billNumber: string;
  totalAmount: number;
  paidAmount?: number | null;
}): string {
  const trimmedName = input.customerName.trim();
  const greetingName =
    trimmedName && trimmedName.toLowerCase() !== "walk-in"
      ? trimmedName
      : "there";
  const company = input.companyName.trim() || "us";
  const date =
    input.billDate.trim() && input.billDate.trim() !== "—"
      ? input.billDate.trim()
      : "";
  const billNo =
    input.billNumber.trim() && input.billNumber.trim() !== "—"
      ? input.billNumber.trim()
      : "";

  const lines = [
    `Hello ${greetingName},`,
    "",
    `Thank you for your purchase with ${company}`,
    "",
  ];
  if (date) lines.push(`Date: ${date}`);
  lines.push(`Bill No: ${billNo}`);
  lines.push(`Total Amount: ${formatRupee(input.totalAmount)}`);
  if (input.paidAmount != null) {
    lines.push(`Paid Amount: ${formatRupee(input.paidAmount)}`);
  }
  lines.push("", "If you have any questions, please contact us.");
  return lines.join("\n");
}

function formatBillDateForWhatsApp(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "dd MMM yyyy");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function openWhatsAppText(phone: string | null | undefined, text: string) {
  const digits = normalizePhoneForWhatsApp(phone ?? "");
  const encoded = encodeURIComponent(text);
  const url = digits
    ? `https://wa.me/${digits}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function buildBillReceiptPdfBlob(
  data: ReceiptPreviewData,
): Promise<Blob> {
  const paperWidth = readPrintSettings().paperWidth;
  const lines = buildReceiptLines(data, paperWidth);
  const businessName = data.businessName?.trim() || "";
  return buildMonospaceReceiptPdf(
    styleReceiptLinesForPdf(lines, businessName),
  );
}

/**
 * Share bill like Android: thank-you text + PDF.
 * Uses Web Share API with file when available; otherwise downloads PDF and
 * opens WhatsApp with the caption.
 */
export async function shareBillOnWhatsApp(
  data: ReceiptPreviewData,
  options?: { includePaidAmount?: boolean },
): Promise<void> {
  const includePaidAmount = options?.includePaidAmount ?? true;
  const billDate = formatBillDateForWhatsApp(data.createdAt);
  const message = buildShortCustomerThankYouMessage({
    customerName: data.customerName,
    companyName: data.businessName?.trim() || "",
    billDate,
    billNumber: data.billNumber?.trim() || "",
    totalAmount: data.totalPayable,
    paidAmount: includePaidAmount ? data.receivedAmount : null,
  });

  const pdfBlob = await buildBillReceiptPdfBlob(data);
  const filename = `bill-${(data.billNumber ?? "receipt").replace(/[^\w.-]+/g, "_")}.pdf`;
  const file = new File([pdfBlob], filename, { type: "application/pdf" });

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };

  if (typeof navigator.share === "function") {
    const payload: ShareData = { text: message, files: [file], title: filename };
    const canShareFiles =
      typeof nav.canShare !== "function" || nav.canShare({ files: [file] });
    if (canShareFiles) {
      try {
        await navigator.share(payload);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        // Fall through to download + wa.me
      }
    }
  }

  downloadBlob(pdfBlob, filename);
  openWhatsAppText(data.customerPhone, message);
}
