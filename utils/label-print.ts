/**
 * Mirrors Android `QrStickerModel` + `QrStickerRenderer.copiesFor` / expand rules.
 */

import type { QrLabelCopiesMode, QrLabelPreferences } from "@/utils/qr-label-preferences";
import { QR_LABEL_MAX_FIXED_COPIES } from "@/utils/qr-label-preferences";

export type QrStickerModel = {
  productId: string;
  productName: string;
  barcode: string;
  sellingPrice: number | null;
  mrp: number | null;
  quantity: number;
};

export type LabelPrintSourceItem = {
  productId: string;
  productName: string;
  barcode: string | null | undefined;
  quantity: number;
  sellingPrice?: number | null;
  mrp?: number | null;
};

export type PrintableLabel = QrStickerModel & {
  key: string;
  copyIndex: number;
  totalCopies: number;
};

export type ExpandLabelsResult = {
  labels: PrintableLabel[];
  models: QrStickerModel[];
  skippedNoBarcode: LabelPrintSourceItem[];
  skippedInvalidQty: LabelPrintSourceItem[];
  totalStickers: number;
};

/** Android `formatBarcodeText` — strip AUTO prefix for display. */
export function formatBarcodeText(barcode: string): string {
  const trimmed = barcode.trim();
  const withoutAuto = trimmed.replace(/^AUTO/i, "").trim();
  return withoutAuto || trimmed;
}

/**
 * Android `CurrencyFormatUtils.formatRupee` (no grouping):
 * 480 → ₹480, 55.5 → ₹55.5, 55.55 → ₹55.55
 */
export function formatLabelPrice(value: number): string {
  if (!Number.isFinite(value)) return "₹0";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat("en", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(abs);
  return `${sign}₹${formatted}`;
}

/** Android `QrStickerRenderer.copiesFor`. */
export function copiesFor(
  quantity: number,
  preferences: Pick<QrLabelPreferences, "copiesMode" | "fixedCopies">,
): number {
  if (preferences.copiesMode === "FIXED") {
    return Math.min(
      QR_LABEL_MAX_FIXED_COPIES,
      Math.max(1, Math.floor(preferences.fixedCopies || 1)),
    );
  }
  // USE_PURCHASE_QTY: ceil(qty).coerceAtLeast(1).coerceAtMost(999)
  if (!Number.isFinite(quantity) || quantity <= 0) return 1;
  return Math.min(999, Math.max(1, Math.ceil(quantity)));
}

export function expandItemsToLabels(
  items: LabelPrintSourceItem[],
  preferences: Pick<QrLabelPreferences, "copiesMode" | "fixedCopies">,
): ExpandLabelsResult {
  const labels: PrintableLabel[] = [];
  const models: QrStickerModel[] = [];
  const skippedNoBarcode: LabelPrintSourceItem[] = [];
  const skippedInvalidQty: LabelPrintSourceItem[] = [];

  for (const item of items) {
    const barcode = item.barcode?.trim() ?? "";
    if (!barcode) {
      skippedNoBarcode.push(item);
      continue;
    }

    const qty = Number(item.quantity);
    if (!Number.isFinite(qty) || qty < 0) {
      skippedInvalidQty.push(item);
      continue;
    }

    const model: QrStickerModel = {
      productId: item.productId,
      productName: item.productName.trim() || "Product",
      barcode,
      sellingPrice: item.sellingPrice ?? null,
      mrp: item.mrp ?? null,
      quantity: qty > 0 ? qty : 1,
    };
    models.push(model);

    const copies = copiesFor(model.quantity, preferences);
    for (let i = 0; i < copies; i += 1) {
      labels.push({
        ...model,
        key: `${model.productId}-${i}`,
        copyIndex: i + 1,
        totalCopies: copies,
      });
    }
  }

  return {
    labels,
    models,
    skippedNoBarcode,
    skippedInvalidQty,
    totalStickers: labels.length,
  };
}

export function summarizeLabelPrint(result: ExpandLabelsResult): string {
  const parts = [
    `${result.totalStickers} sticker${result.totalStickers === 1 ? "" : "s"}`,
  ];
  if (result.skippedNoBarcode.length > 0) {
    parts.push(
      `${result.skippedNoBarcode.length} skipped (no barcode)`,
    );
  }
  return parts.join(" · ");
}

/** @deprecated use copiesFor */
export function labelCopyCount(quantity: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return Math.floor(quantity);
}
