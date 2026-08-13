import type { QrStickerModel } from "@/utils/label-print";
import { copiesFor } from "@/utils/label-print";
import {
  chunkIntoRows,
  getQrLabelLayoutConfig,
  padLabelsToColumns,
} from "@/utils/qr-label-layout";
import {
  QR_LABEL_DEFAULT_DPI,
  type QrLabelPreferences,
} from "@/utils/qr-label-preferences";
import {
  combineStickersVertically,
  renderQrStickerBitmap,
} from "@/utils/qr-sticker-renderer";
import { renderQrStickerSvg } from "@/utils/qr-sticker-svg";
import { printHtmlDocument } from "@/utils/print-label-document";

export async function buildStickerCanvases(
  models: QrStickerModel[],
  preferences: QrLabelPreferences,
  dpi = QR_LABEL_DEFAULT_DPI,
): Promise<HTMLCanvasElement[]> {
  const printable = models.filter((m) => m.barcode.trim());
  const out: HTMLCanvasElement[] = [];
  for (const model of printable) {
    const copies = copiesFor(model.quantity, preferences);
    const sticker = await renderQrStickerBitmap(model, preferences, dpi);
    for (let i = 0; i < copies; i += 1) {
      out.push(sticker);
    }
  }
  return out;
}

function expandModelsForPrint(
  models: QrStickerModel[],
  preferences: QrLabelPreferences,
): QrStickerModel[] {
  const out: QrStickerModel[] = [];
  for (const model of models) {
    if (!model.barcode.trim()) continue;
    const copies = copiesFor(model.quantity, preferences);
    for (let i = 0; i < copies; i += 1) {
      out.push(model);
    }
  }
  return out;
}

/**
 * Print stickers as a vector (SVG) document sized in mm.
 *
 * Chrome Print Preview stays sharp (vector QR + real SVG text).
 * Physical @page / label sizes are unchanged (25×25 / 50×30, N per row).
 * The TE210 driver still rasters the page at its native 203 DPI — we do not
 * embed or upscale a 203-DPI PNG for print.
 */
export async function printQrStickers(
  models: QrStickerModel[],
  preferences: QrLabelPreferences,
): Promise<number> {
  const stickers = expandModelsForPrint(models, preferences);
  if (stickers.length === 0) {
    throw new Error("No stickers to print. Add barcodes to products first.");
  }

  const layout = getQrLabelLayoutConfig(preferences.labelSize);
  const cells = padLabelsToColumns(stickers, layout.columns);
  const rows = chunkIntoRows(cells, layout.columns);

  const rowHtml = rows
    .map((row) => {
      const cellsHtml = row
        .map((model) => {
          if (!model) {
            return `<div class="label-cell label-empty" aria-hidden="true"></div>`;
          }
          // SVG viewBox = 203-DPI layout units; CSS width/height = physical mm.
          const svg = renderQrStickerSvg(
            model,
            preferences,
            QR_LABEL_DEFAULT_DPI,
          );
          return `<div class="label-cell">${svg}</div>`;
        })
        .join("");
      return `<section class="label-row">${cellsHtml}</section>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>QR Labels · ${layout.labelWidth}×${layout.labelHeight}mm · ${layout.columns}/row</title>
  <style>
    @page {
      size: ${layout.pageWidthMm}mm ${layout.pageHeightMm}mm;
      margin: 0;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: ${layout.pageWidthMm}mm;
      background: #fff;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    * { box-sizing: border-box; }
    .label-row {
      width: ${layout.pageWidthMm}mm;
      height: ${layout.pageHeightMm}mm;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      align-items: stretch;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
    }
    .label-row:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .label-cell {
      width: ${layout.labelWidth}mm;
      height: ${layout.labelHeight}mm;
      flex: 0 0 ${layout.labelWidth}mm;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #fff;
    }
    .label-empty {
      background: #fff;
    }
    .label-cell > svg {
      display: block;
      width: ${layout.labelWidth}mm;
      height: ${layout.labelHeight}mm;
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>${rowHtml}</body>
</html>`;

  await printHtmlDocument(html);
  return stickers.length;
}

/** @deprecated use printQrStickers */
export const printProductQrLabels = printQrStickers;

/**
 * Share stickers as one vertical PNG (Android `QrLabelShareHelper`).
 */
export async function shareQrStickers(
  models: QrStickerModel[],
  preferences: QrLabelPreferences,
): Promise<void> {
  const canvases = await buildStickerCanvases(models, preferences);
  if (canvases.length === 0) {
    throw new Error("No stickers to share. Add barcodes to products first.");
  }

  const combined = combineStickersVertically(canvases);

  const blob = await new Promise<Blob>((resolve, reject) => {
    combined.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not create image."))),
      "image/png",
    );
  });

  const file = new File([blob], `qr_labels_${Date.now()}.png`, {
    type: "image/png",
  });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: "QR labels",
      text: "QR labels",
    });
    return;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
