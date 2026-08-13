/**
 * Single source of truth for QR label sheet layout.
 * Used by preview, print CSS, QR sizing callers, and print document generation.
 *
 * Android POS prints one sticker at a time (ESC/POS). Postrack web uses a
 * multi-across sheet layout for USB label printers (e.g. TSC TE210).
 */

import type { QrLabelSize } from "@/utils/qr-label-preferences";
import { labelSizeMm } from "@/utils/qr-label-preferences";

export type QrLabelLayoutConfig = {
  size: QrLabelSize;
  /** Individual label width (mm). */
  labelWidth: number;
  /** Individual label height (mm). */
  labelHeight: number;
  /** Labels per row. */
  columns: number;
  /** Gap between labels in a row (mm). 0 for abutting die-cut media. */
  gapMm: number;
  /** Page / media width for one printed row (mm). */
  pageWidthMm: number;
  /** Page / media height for one printed row (mm). */
  pageHeightMm: number;
};

/** Columns for each physical label size. */
const COLUMNS: Record<QrLabelSize, number> = {
  SMALL: 4,
  LARGE: 2,
};

export function getQrLabelLayoutConfig(size: QrLabelSize): QrLabelLayoutConfig {
  const { widthMm, heightMm } = labelSizeMm(size);
  const columns = COLUMNS[size];
  const gapMm = 0;
  return {
    size,
    labelWidth: widthMm,
    labelHeight: heightMm,
    columns,
    gapMm,
    pageWidthMm: columns * widthMm + Math.max(0, columns - 1) * gapMm,
    pageHeightMm: heightMm,
  };
}

/** Pad sticker list so the last row fills `columns` (null = empty cell). */
export function padLabelsToColumns<T>(
  labels: T[],
  columns: number,
): Array<T | null> {
  if (columns <= 0) return [...labels];
  const remainder = labels.length % columns;
  if (remainder === 0) return [...labels];
  const pad = columns - remainder;
  return [...labels, ...Array.from({ length: pad }, () => null)];
}

/** Split padded cells into rows of `columns`. */
export function chunkIntoRows<T>(
  cells: Array<T | null>,
  columns: number,
): Array<Array<T | null>> {
  if (columns <= 0) return [cells];
  const rows: Array<Array<T | null>> = [];
  for (let i = 0; i < cells.length; i += columns) {
    rows.push(cells.slice(i, i + columns));
  }
  return rows;
}
