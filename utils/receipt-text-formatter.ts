/**
 * Monospace thermal receipt layout — mirrors Android `ReceiptTextFormatter`.
 */

import type { ReceiptPaperWidth } from "@/utils/print-settings";

export type ReceiptFormatterItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  rowTotal: number;
  mrp?: number | null;
};

export type ReceiptFormatterInput = {
  businessName: string;
  businessAddress?: string | null;
  businessPhone?: string | null;
  businessGstin?: string | null;
  billNumber: string;
  createdAt?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  items: ReceiptFormatterItem[];
  /** Item subtotal only (other items are folded into lines like Android). */
  subtotal: number;
  otherItemsAmount?: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  receiptFooter?: string | null;
};

type ReceiptLayout = {
  lineWidth: number;
  itemColWidth: number;
  qtyColWidth: number;
  rateColWidth: number;
  amountColWidth: number;
  divider: string;
};

/**
 * Android `ReceiptTextFormatter.ReceiptLayout.forPaperSize`.
 * Column widths change with roll size (Item col grows on 76/80mm).
 */
export function getReceiptTextLayout(
  paperWidth: ReceiptPaperWidth,
): ReceiptLayout {
  const base =
    paperWidth === "58mm"
      ? {
          lineWidth: 32,
          itemColWidth: 8,
          qtyColWidth: 3,
          rateColWidth: 7,
          amountColWidth: 8,
        }
      : paperWidth === "76mm"
        ? {
            lineWidth: 44,
            itemColWidth: 21,
            qtyColWidth: 3,
            rateColWidth: 7,
            amountColWidth: 8,
          }
        : {
            lineWidth: 48,
            itemColWidth: 24,
            qtyColWidth: 3,
            rateColWidth: 7,
            amountColWidth: 8,
          };

  return { ...base, divider: "-".repeat(base.lineWidth) };
}

/** Android `CurrencyFormatUtils.formatMoneyForPrint`. */
export function formatMoneyForPrint(
  amount: number,
  withGrouping = true,
): string {
  if (!Number.isFinite(amount)) return "0";
  const rounded = Math.round(amount * 100) / 100;
  const hasFraction = Math.abs(rounded % 1) > 1e-9;
  return new Intl.NumberFormat("en-US", {
    useGrouping: withGrouping,
    minimumFractionDigits: 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(rounded);
}

/** Android `CurrencyFormatUtils.formatQuantity`. */
export function formatQuantity(quantity: number): string {
  if (!Number.isFinite(quantity)) return "0";
  const rounded = Math.round(quantity * 1000) / 1000;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(Number(rounded.toFixed(3)));
}

function formatMoneyForColumn(value: number, maxWidth: number): string {
  const grouped = formatMoneyForPrint(value, true);
  if (grouped.length <= maxWidth) return grouped;
  const compact = formatMoneyForPrint(value, false);
  if (compact.length <= maxWidth) return compact;
  return compact.slice(0, Math.max(maxWidth, 4));
}

export function formatSavedOnMrpLine(savedAmount: number): string {
  return `** Saved Rs. ${formatMoneyForPrint(savedAmount)}/- on MRP **`;
}

export function isSavedOnMrpLine(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("** Saved Rs.") && trimmed.endsWith(" on MRP **");
}

export function computeSavedOnMrpAmount(items: ReceiptFormatterItem[]): number {
  return items.reduce((sum, item) => {
    const mrp = item.mrp;
    if (mrp == null || !Number.isFinite(mrp)) return sum;
    const savingsPerUnit = mrp - item.unitPrice;
    if (savingsPerUnit <= 0) return sum;
    return sum + savingsPerUnit * item.quantity;
  }, 0);
}

function alignLeftRight(left: string, right: string, lineWidth: number): string {
  const safeLeft = left.trim();
  const safeRight = right.trim();
  const remaining = lineWidth - safeLeft.length - safeRight.length;
  if (remaining >= 1) {
    return safeLeft + " ".repeat(remaining) + safeRight;
  }
  const allowedLeft = Math.max(lineWidth - safeRight.length - 1, 0);
  return `${safeLeft.slice(0, allowedLeft)} ${safeRight}`;
}

function center(text: string, lineWidth: number): string {
  const value = text.trim();
  if (value.length >= lineWidth) return value.slice(0, lineWidth);
  const leftPadding = Math.floor((lineWidth - value.length) / 2);
  return " ".repeat(leftPadding) + value;
}

function wrapText(text: string, width: number): string[] {
  const clean = text.trim();
  if (!clean) return [""];

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (word.length <= width) {
      current = word;
    } else {
      for (let i = 0; i < word.length; i += width) {
        const part = word.slice(i, i + width);
        if (i + width < word.length) lines.push(part);
        else current = part;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function fitRightPad(text: string, width: number): string {
  return text.slice(0, width).padEnd(width, " ");
}

function fitLeftPad(text: string, width: number): string {
  return text.slice(0, width).padStart(width, " ");
}

function formatCompactDateTime(createdAt?: string | null): string {
  if (!createdAt?.trim()) return "--";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "--";

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const hh = String(hours).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${minutes} ${ampm}`;
}

function formatBillMetaLines(
  billNumber: string,
  createdAt: string | null | undefined,
  lineWidth: number,
): string[] {
  const left = `BN: ${billNumber}`;
  const right = formatCompactDateTime(createdAt);
  if (left.length + 1 + right.length <= lineWidth) {
    return [alignLeftRight(left, right, lineWidth)];
  }
  return [left.slice(0, lineWidth), right.slice(0, lineWidth)];
}

function formatItemHeaderRow(layout: ReceiptLayout): string {
  return (
    fitRightPad("Item", layout.itemColWidth) +
    "  " +
    fitLeftPad("Qty", layout.qtyColWidth) +
    "  " +
    fitLeftPad("Rate", layout.rateColWidth) +
    "  " +
    fitLeftPad("Amt", layout.amountColWidth)
  );
}

function formatItemLines(
  item: ReceiptFormatterItem,
  layout: ReceiptLayout,
): string[] {
  const wrappedNameLines = wrapText(item.name, layout.itemColWidth);
  return wrappedNameLines.map((line, index) => {
    if (index !== wrappedNameLines.length - 1) return line;
    return (
      fitRightPad(line, layout.itemColWidth) +
      "  " +
      fitLeftPad(formatQuantity(item.quantity), layout.qtyColWidth) +
      "  " +
      fitLeftPad(
        formatMoneyForColumn(item.unitPrice, layout.rateColWidth),
        layout.rateColWidth,
      ) +
      "  " +
      fitLeftPad(
        formatMoneyForColumn(item.rowTotal, layout.amountColWidth),
        layout.amountColWidth,
      )
    );
  });
}

function amountLine(label: string, amount: number, lineWidth: number): string {
  return alignLeftRight(label, formatMoneyForPrint(amount), lineWidth);
}

/**
 * Build plain-text receipt lines identical to Android thermal layout.
 */
export function buildReceiptText(
  input: ReceiptFormatterInput,
  paperWidth: ReceiptPaperWidth,
): string {
  const layout = getReceiptTextLayout(paperWidth);
  const lines: string[] = [];

  const receiptItems: ReceiptFormatterItem[] = [...input.items];
  const otherItemsAmount = input.otherItemsAmount ?? 0;
  if (otherItemsAmount > 0) {
    receiptItems.push({
      name: "Other Items",
      quantity: 1,
      unitPrice: otherItemsAmount,
      rowTotal: otherItemsAmount,
    });
  }

  const displaySubtotal = input.subtotal + otherItemsAmount;
  const remaining = Math.max(input.totalAmount - input.paidAmount, 0);
  const savedOnMrp = computeSavedOnMrpAmount(input.items);

  lines.push(center(input.businessName.trim(), layout.lineWidth));
  lines.push("");

  const address = input.businessAddress?.trim();
  if (address) {
    for (const line of wrapText(address, layout.lineWidth)) {
      lines.push(center(line, layout.lineWidth));
    }
  }

  const phone = input.businessPhone?.trim();
  if (phone) lines.push(center(`Ph: ${phone}`, layout.lineWidth));

  const gstin = input.businessGstin?.trim();
  if (gstin) lines.push(center(`GSTIN: ${gstin}`, layout.lineWidth));

  lines.push(layout.divider);
  lines.push(
    ...formatBillMetaLines(input.billNumber, input.createdAt, layout.lineWidth),
  );

  const customerName = input.customerName?.trim() ?? "";
  const customerPhone = input.customerPhone?.trim() ?? "";
  const customerLine =
    customerName && customerPhone
      ? `Customer: ${customerName}-${customerPhone}`
      : customerName
        ? `Customer: ${customerName}`
        : customerPhone
          ? `Customer: ${customerPhone}`
          : null;
  if (customerLine) {
    lines.push(...wrapText(customerLine, layout.lineWidth));
  }

  lines.push(layout.divider);
  lines.push(formatItemHeaderRow(layout));
  lines.push(layout.divider);

  for (const item of receiptItems) {
    lines.push(...formatItemLines(item, layout));
  }

  lines.push(layout.divider);
  lines.push(amountLine("Subtotal", displaySubtotal, layout.lineWidth));
  lines.push(amountLine("Discount", input.discountAmount, layout.lineWidth));
  lines.push(layout.divider);
  lines.push(amountLine("TOTAL", input.totalAmount, layout.lineWidth));
  lines.push(layout.divider);
  lines.push(amountLine("Paid Amount", input.paidAmount, layout.lineWidth));
  if (remaining > 0) {
    lines.push(amountLine("Remaining", remaining, layout.lineWidth));
  }

  if (savedOnMrp > 0) {
    lines.push(layout.divider);
    lines.push(center(formatSavedOnMrpLine(savedOnMrp), layout.lineWidth));
    lines.push("");
  }

  const footer = input.receiptFooter?.trim();
  if (footer) {
    for (const line of wrapText(footer, layout.lineWidth)) {
      lines.push(center(line, layout.lineWidth));
    }
  }

  return lines.join("\n");
}

export function receiptLineStyle(
  line: string,
  businessName: string,
): "title" | "emph" | "divider" | "normal" {
  const trimmed = line.trim();
  if (!trimmed) return "normal";
  if (trimmed === "-".repeat(trimmed.length) && trimmed.length >= 8) {
    return "divider";
  }
  if (trimmed === businessName.trim()) {
    return "title";
  }
  // Android PDF: TOTAL, Paid Amount, Remaining, Saved on MRP are bold.
  if (
    trimmed.startsWith("TOTAL") ||
    trimmed.startsWith("Paid Amount") ||
    trimmed.startsWith("Remaining") ||
    isSavedOnMrpLine(trimmed)
  ) {
    return "emph";
  }
  return "normal";
}
