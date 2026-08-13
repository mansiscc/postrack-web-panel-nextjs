/**
 * Canvas sticker renderer for on-screen preview / share.
 * Print documents use vector SVG (`qr-sticker-svg.ts`) instead of this PNG path.
 */

import {
  computeStickerLayout,
  layoutQrMatrix,
  MIN_QR_MODULE_PX,
  QR_QUIET_MODULES,
} from "@/utils/qr-sticker-layout";
import {
  QR_LABEL_DEFAULT_DPI,
  type QrLabelPreferences,
  type QrLabelSize,
} from "@/utils/qr-label-preferences";
import { labelSizeMm, mmToPx } from "@/utils/qr-label-preferences";
import type { QrStickerModel } from "@/utils/label-print";

const PRINT_BLACK = "#000000";
const PRINT_WHITE = "#ffffff";
const BW_THRESHOLD = 180;

/**
 * Render a QR at an integer module size that fits in `maxSidePx`.
 * Drawn with fillRect — never scaled — so modules stay crisp at 203 DPI.
 */
export function renderModuleAlignedQr(
  payload: string,
  maxSidePx: number,
  minModulePx = MIN_QR_MODULE_PX,
): HTMLCanvasElement {
  const layout = layoutQrMatrix(payload, maxSidePx, minModulePx);
  const canvas = document.createElement("canvas");
  canvas.width = layout.side;
  canvas.height = layout.side;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PRINT_WHITE;
  ctx.fillRect(0, 0, layout.side, layout.side);
  ctx.fillStyle = PRINT_BLACK;

  for (let row = 0; row < layout.n; row += 1) {
    for (let col = 0; col < layout.n; col += 1) {
      if (!layout.dark[row]?.[col]) continue;
      ctx.fillRect(
        (col + QR_QUIET_MODULES) * layout.modulePx,
        (row + QR_QUIET_MODULES) * layout.modulePx,
        layout.modulePx,
        layout.modulePx,
      );
    }
  }

  return canvas;
}

function thresholdCanvasToBw(
  canvas: HTMLCanvasElement,
  threshold = BW_THRESHOLD,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  if (width < 1 || height < 1) return;
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const luminance =
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const v = luminance < threshold ? 0 : 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

export type LabelPixelSize = {
  widthPx: number;
  heightPx: number;
  widthMm: number;
  heightMm: number;
  dpi: number;
};

export function getLabelPixelSize(
  labelSize: QrLabelSize,
  dpi = QR_LABEL_DEFAULT_DPI,
): LabelPixelSize {
  const { widthMm, heightMm } = labelSizeMm(labelSize);
  return {
    widthMm,
    heightMm,
    dpi,
    widthPx: mmToPx(widthMm, dpi),
    heightPx: mmToPx(heightMm, dpi),
  };
}

export type RenderQrStickerOptions = {
  flattenToBw?: boolean;
};

/**
 * Render one sticker bitmap (website preview / share).
 * Layout matches SVG print via {@link computeStickerLayout}.
 */
export async function renderQrStickerBitmap(
  model: QrStickerModel,
  preferences: QrLabelPreferences,
  dpi = QR_LABEL_DEFAULT_DPI,
  options?: RenderQrStickerOptions,
): Promise<HTMLCanvasElement> {
  const flattenToBw = options?.flattenToBw ?? dpi <= QR_LABEL_DEFAULT_DPI;
  const layout = computeStickerLayout(model, preferences, dpi);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PRINT_WHITE;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const drawText = (block: NonNullable<typeof layout.title>) => {
    ctx.save();
    ctx.fillStyle = PRINT_BLACK;
    ctx.font = `${block.fontWeight} ${block.fontPx}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    const spacing = block.letterSpacingPx ?? 0;

    const fillSpaced = (text: string, x: number, y: number) => {
      if (spacing <= 0 || text.length <= 1) {
        ctx.fillText(text, x, y);
        return;
      }
      const advances = Array.from(text).map((ch) => ctx.measureText(ch).width);
      const total =
        advances.reduce((sum, w) => sum + w, 0) + spacing * (text.length - 1);
      let cursor = x - total / 2;
      ctx.textAlign = "left";
      for (let i = 0; i < text.length; i += 1) {
        ctx.fillText(text[i]!, cursor, y);
        cursor += advances[i]! + spacing;
      }
    };

    if (block.rotationDeg !== 0) {
      ctx.translate(block.x, block.y);
      ctx.rotate((block.rotationDeg * Math.PI) / 180);
      ctx.textBaseline = "middle";
      fillSpaced(block.text, 0, 0);
    } else {
      ctx.textBaseline = "alphabetic";
      fillSpaced(block.text, block.x, block.y);
    }
    ctx.restore();
  };

  if (layout.title) drawText(layout.title);

  // Paint QR from shared layout (same modules as SVG print) — 1:1 rects, no scale.
  ctx.fillStyle = PRINT_WHITE;
  ctx.fillRect(layout.qr.left, layout.qr.top, layout.qr.side, layout.qr.side);
  ctx.fillStyle = PRINT_BLACK;
  for (let row = 0; row < layout.qr.n; row += 1) {
    for (let col = 0; col < layout.qr.n; col += 1) {
      if (!layout.qr.dark[row]?.[col]) continue;
      ctx.fillRect(
        layout.qr.left + (col + layout.qr.quiet) * layout.qr.modulePx,
        layout.qr.top + (row + layout.qr.quiet) * layout.qr.modulePx,
        layout.qr.modulePx,
        layout.qr.modulePx,
      );
    }
  }

  if (layout.code) drawText(layout.code);
  if (layout.price) drawText(layout.price);

  if (flattenToBw) {
    thresholdCanvasToBw(canvas);
  }
  return canvas;
}

export function stickerCanvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}

export function composeLabelRowBitmap(
  cells: Array<HTMLCanvasElement | null>,
  labelWidthPx: number,
  labelHeightPx: number,
  columns: number,
): HTMLCanvasElement {
  const page = document.createElement("canvas");
  page.width = labelWidthPx * columns;
  page.height = labelHeightPx;
  const ctx = page.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PRINT_WHITE;
  ctx.fillRect(0, 0, page.width, page.height);

  for (let i = 0; i < columns; i += 1) {
    const sticker = cells[i];
    if (!sticker) continue;
    const x = i * labelWidthPx;
    if (sticker.width === labelWidthPx && sticker.height === labelHeightPx) {
      ctx.drawImage(sticker, x, 0);
    } else {
      const dx = x + Math.max(0, Math.floor((labelWidthPx - sticker.width) / 2));
      const dy = Math.max(0, Math.floor((labelHeightPx - sticker.height) / 2));
      ctx.drawImage(sticker, dx, dy);
    }
  }

  return page;
}

export function combineStickersVertically(
  canvases: HTMLCanvasElement[],
  gapPx = 8,
): HTMLCanvasElement {
  const width = Math.max(...canvases.map((c) => c.width), 1);
  const height =
    canvases.reduce((sum, c) => sum + c.height, 0) +
    gapPx * Math.max(0, canvases.length - 1);
  const out = document.createElement("canvas");
  out.width = width;
  out.height = Math.max(1, height);
  const ctx = out.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PRINT_WHITE;
  ctx.fillRect(0, 0, out.width, out.height);
  let y = 0;
  canvases.forEach((bmp, index) => {
    const left = Math.round((width - bmp.width) / 2);
    ctx.drawImage(bmp, left, y);
    y += bmp.height;
    if (index < canvases.length - 1) y += gapPx;
  });
  thresholdCanvasToBw(out);
  return out;
}
