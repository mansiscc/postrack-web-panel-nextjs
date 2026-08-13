/**
 * Single source of truth for thermal receipt print layout.
 * Mirrors Android `PrinterPaperSize` (roll width vs printable width).
 *
 * Android values:
 * - 58mm roll → 48mm printable, 32 chars/line
 * - 80mm roll → 72mm printable, 48 chars/line
 * (76mm exists on Android but is not offered on web yet.)
 */

import type { ReceiptPaperWidth } from "@/utils/print-settings";

export type ReceiptPrintLayout = {
  /** Roll / media width shown in settings and `@page` size (mm). */
  paperWidthMm: number;
  /**
   * Actual printable width inside the roll (mm).
   * Content is sized to this; side margins fill the rest of the paper.
   */
  printableWidthMm: number;
  /** ESC/POS column count (reference for density). */
  charactersPerLine: number;
  /** Horizontal margin each side = (paper − printable) / 2. */
  sideMarginMm: number;
  bodyFontPx: number;
  titleFontPx: number;
};

const LAYOUTS: Record<ReceiptPaperWidth, Omit<ReceiptPrintLayout, "sideMarginMm">> = {
  "58mm": {
    paperWidthMm: 58,
    printableWidthMm: 48,
    charactersPerLine: 32,
    bodyFontPx: 10,
    titleFontPx: 13,
  },
  "80mm": {
    paperWidthMm: 80,
    printableWidthMm: 72,
    charactersPerLine: 48,
    bodyFontPx: 12,
    titleFontPx: 15,
  },
};

export function getReceiptPrintLayout(
  paperWidth: ReceiptPaperWidth,
): ReceiptPrintLayout {
  const base = LAYOUTS[paperWidth];
  return {
    ...base,
    sideMarginMm: Number(
      ((base.paperWidthMm - base.printableWidthMm) / 2).toFixed(2),
    ),
  };
}

/**
 * Estimate `@page` height from receipt content so preview matches QR-label
 * style (page ≈ content), not a full A4-tall strip.
 */
export function estimateReceiptPageHeightMm(input: {
  itemCount: number;
  hasOtherItems: boolean;
  hasDiscount: boolean;
  hasFooter: boolean;
  hasPhone: boolean;
  hasStatus: boolean;
  hasLogo?: boolean;
}): number {
  // Header (title + bill# + date)
  let height = 18;
  if (input.hasLogo) height += 18;
  // Customer / payment meta
  height += 12;
  if (input.hasPhone) height += 4;
  if (input.hasStatus) height += 4;
  // Table header + rows (wrapped names on 58mm need a bit more)
  height += 6 + input.itemCount * 7;
  // Totals block
  height += 14;
  if (input.hasOtherItems) height += 4;
  if (input.hasDiscount) height += 4;
  if (input.hasFooter) height += 10;
  // Top/bottom padding
  height += 6;

  // Keep short bills readable; cap runaway tall bills.
  return Math.min(400, Math.max(70, Math.ceil(height)));
}
