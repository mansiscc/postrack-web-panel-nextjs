/**
 * Single source of truth for thermal receipt print layout.
 * Mirrors Android `PrinterPaperSize` + PDF share sizes from `ReceiptVisualRenderer`.
 *
 * Android values:
 * - 58mm roll → 48mm printable, 32 chars/line
 * - 76mm roll → 68mm printable, 44 chars/line
 * - 80mm roll → 72mm printable, 48 chars/line
 * - PDF body 8.5pt, company name 11.5pt bold
 */

import type { ReceiptPaperWidth } from "@/utils/print-settings";

/** Android `ReceiptVisualRenderer` PDF body size. */
export const RECEIPT_BODY_FONT_PT = 8.5;
/** Android `ReceiptVisualRenderer` company-name size. */
export const RECEIPT_TITLE_FONT_PT = 11.5;

/** CSS px at 96dpi for 1pt. */
const PT_TO_PX = 96 / 72;

export type ReceiptPrintLayout = {
  /** Roll / media width shown in settings and `@page` size (mm). */
  paperWidthMm: number;
  /**
   * Actual printable width inside the roll (mm).
   * Content is sized to this; side margins fill the rest of the paper.
   */
  printableWidthMm: number;
  /** ESC/POS column count (monospace chars per line). */
  charactersPerLine: number;
  /** Horizontal margin each side = (paper − printable) / 2. */
  sideMarginMm: number;
  /** On-screen preview body size (px) ≈ Android PDF 8.5pt. */
  bodyFontPx: number;
  /** On-screen preview company name size (px) ≈ Android PDF 11.5pt. */
  titleFontPx: number;
  /** Print / Save PDF body size (pt). */
  bodyFontPt: number;
  /** Print / Save PDF company name size (pt). */
  titleFontPt: number;
};

const LAYOUTS: Record<
  ReceiptPaperWidth,
  Omit<ReceiptPrintLayout, "sideMarginMm" | "bodyFontPx" | "titleFontPx" | "bodyFontPt" | "titleFontPt">
> = {
  "58mm": {
    paperWidthMm: 58,
    printableWidthMm: 48,
    charactersPerLine: 32,
  },
  "76mm": {
    paperWidthMm: 76,
    printableWidthMm: 68,
    charactersPerLine: 44,
  },
  "80mm": {
    paperWidthMm: 80,
    printableWidthMm: 72,
    charactersPerLine: 48,
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
    bodyFontPt: RECEIPT_BODY_FONT_PT,
    titleFontPt: RECEIPT_TITLE_FONT_PT,
    // Screen preview uses the same pt→px conversion as Android PDF density.
    bodyFontPx: Number((RECEIPT_BODY_FONT_PT * PT_TO_PX).toFixed(2)),
    titleFontPx: Number((RECEIPT_TITLE_FONT_PT * PT_TO_PX).toFixed(2)),
  };
}

/**
 * Estimate `@page` height from monospace line count (Android-style strip).
 * Slightly generous so content is not forced onto a second page before measure.
 */
export function estimateReceiptPageHeightMm(input: {
  lineCount: number;
  hasLogo?: boolean;
}): number {
  // ~ body font ~2.5mm × line-height 1.25 ≈ 3.1mm per line, plus padding.
  let height = 6 + input.lineCount * 3.4;
  if (input.hasLogo) height += 20;
  height += 8;
  return Math.min(500, Math.max(60, Math.ceil(height)));
}
