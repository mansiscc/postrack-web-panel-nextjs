/**
 * Daily sales receipt — mirrors Android `TransactionDayReceiptTextFormatter`.
 */

import { format, parseISO } from "date-fns";

import type { ReceiptPaperWidth } from "@/utils/print-settings";
import { formatMoneyForPrint } from "@/utils/receipt-text-formatter";

export const DAILY_SALES_RECEIPT_TITLE = "DAILY SALES";
export const DAILY_SALES_TOTAL_LABEL = "Total Sales";

/** Accepts both app `Bill #123` and web `Bill 123` remarks. */
const BILL_NUMBER_PATTERN = /Bill\s*#?\s*(\S+)/i;

export type DailySalesReceiptItem = {
  remarks: string | null;
  amount: number;
  createdAt: string;
};

type SalesReceiptLayout = {
  lineWidth: number;
  columnGap: string;
  timeColWidth: number;
  amountColWidth: number;
  billColWidth: number;
};

function layoutForPaper(paperWidth: ReceiptPaperWidth): SalesReceiptLayout {
  const lineWidth =
    paperWidth === "58mm" ? 32 : paperWidth === "76mm" ? 44 : 48;
  const columnGap = " ";
  const timeColWidth = 5;
  const amountColWidth =
    lineWidth <= 32 ? 8 : lineWidth <= 44 ? 9 : 10;
  const gaps = columnGap.length * 2;
  const billColWidth = Math.max(
    8,
    lineWidth - timeColWidth - amountColWidth - gaps,
  );
  return {
    lineWidth,
    columnGap,
    timeColWidth,
    amountColWidth,
    billColWidth,
  };
}

function center(text: string, lineWidth: number): string {
  const value = text.trim();
  if (value.length >= lineWidth) return value.slice(0, lineWidth);
  const pad = Math.floor((lineWidth - value.length) / 2);
  return `${" ".repeat(pad)}${value}`;
}

export function extractBillNumber(remarks: string | null | undefined): string {
  const text = remarks?.trim() ?? "";
  if (!text) return "—";
  const match = BILL_NUMBER_PATTERN.exec(text);
  const billNo = match?.[1]?.trim();
  return billNo || "—";
}

/** Android `DateUtils.formatTime24Hour` → `HH:mm`. */
export function formatTime24Hour(iso: string | null | undefined): string {
  if (!iso?.trim()) return "--";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  return format(date, "HH:mm");
}

function formatReceiptDateTitle(dateIso: string): string {
  try {
    return format(parseISO(dateIso), "dd MMM yyyy");
  } catch {
    return dateIso;
  }
}

function buildTitleLine(dateLabel: string, lineWidth: number): string {
  const candidates = [
    `${DAILY_SALES_RECEIPT_TITLE} · Date: ${dateLabel}`,
    `${DAILY_SALES_RECEIPT_TITLE} · ${dateLabel}`,
    `${DAILY_SALES_RECEIPT_TITLE} ${dateLabel}`,
  ];
  const text =
    candidates.find((candidate) => candidate.length <= lineWidth) ??
    DAILY_SALES_RECEIPT_TITLE;
  return center(text.slice(0, lineWidth), lineWidth);
}

function formatSalesRow(
  billNo: string,
  time: string,
  amount: string,
  layout: SalesReceiptLayout,
  amountAlignEnd = true,
): string {
  const billPart = billNo.trim().slice(0, layout.billColWidth).padEnd(
    layout.billColWidth,
  );
  const timePart = time.trim().slice(0, layout.timeColWidth).padEnd(
    layout.timeColWidth,
  );
  const amountPart = amountAlignEnd
    ? amount.slice(0, layout.amountColWidth).padStart(layout.amountColWidth)
    : amount.slice(0, layout.amountColWidth).padEnd(layout.amountColWidth);
  return [billPart, timePart, amountPart].join(layout.columnGap);
}

function formatTableHeader(layout: SalesReceiptLayout): string {
  const billHeader = layout.lineWidth >= 40 ? "Bill No" : "Bill";
  const timeHeader = layout.lineWidth >= 36 ? "Time" : "Tm";
  const amountHeader = layout.lineWidth >= 36 ? "Amount" : "Amt";
  return formatSalesRow(billHeader, timeHeader, amountHeader, layout, true);
}

export function buildDailySalesReceiptLines(input: {
  businessName: string;
  dateIso: string;
  items: DailySalesReceiptItem[];
  paperWidth: ReceiptPaperWidth;
}): string[] {
  const layout = layoutForPaper(input.paperWidth);
  const div = "-".repeat(layout.lineWidth);
  const dateLabel = formatReceiptDateTitle(input.dateIso);
  const sorted = [...input.items].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const salesTotal = sorted.reduce((sum, item) => sum + item.amount, 0);

  const lines: string[] = [];
  lines.push(
    center(
      input.businessName.trim().slice(0, layout.lineWidth),
      layout.lineWidth,
    ),
  );
  lines.push("");
  lines.push(buildTitleLine(dateLabel, layout.lineWidth));
  lines.push(div);

  if (sorted.length === 0) {
    lines.push(center("No sales entries", layout.lineWidth));
  } else {
    lines.push(formatTableHeader(layout));
    lines.push(div);
    for (const item of sorted) {
      lines.push(
        formatSalesRow(
          extractBillNumber(item.remarks),
          formatTime24Hour(item.createdAt),
          formatMoneyForPrint(item.amount, true),
          layout,
        ),
      );
    }
    lines.push(div);
    lines.push(
      formatSalesRow(
        DAILY_SALES_TOTAL_LABEL,
        "",
        formatMoneyForPrint(salesTotal, true),
        layout,
      ),
    );
  }

  return lines;
}

export function dailySalesLineStyle(
  line: string,
  businessName: string,
): "title" | "emph" | "normal" {
  const trimmed = line.trim();
  const bn = businessName.trim();
  if (bn && trimmed === bn) return "title";
  if (trimmed.includes(DAILY_SALES_RECEIPT_TITLE)) return "emph";
  if (trimmed.startsWith(DAILY_SALES_TOTAL_LABEL)) return "emph";
  return "normal";
}
