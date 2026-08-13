/**
 * Shared sticker layout in 203-DPI reference units.
 * Used by canvas preview and SVG print so proportions stay identical.
 *
 * Layout (top → bottom):
 *   title (optional)
 *   [ QR | barcode text @ 270° ]  (code sits beside QR when enabled)
 *   price (optional)
 */

import QRCode from "qrcode";

import {
  formatBarcodeText,
  formatLabelPrice,
  type QrStickerModel,
} from "@/utils/label-print";
import {
  labelSizeMm,
  mmToPx,
  QR_LABEL_DEFAULT_DPI,
  type QrLabelPreferences,
  type QrLabelSize,
  type QrLabelTextSize,
} from "@/utils/qr-label-preferences";

export const QR_QUIET_MODULES = 1;
export const MIN_QR_MODULE_PX = 2;

function textScale(size: QrLabelTextSize): number {
  if (size === "SMALL") return 0.85;
  if (size === "LARGE") return 1.15;
  return 1;
}

export function titleFontPx(
  titleSize: QrLabelTextSize,
  labelSize: QrLabelSize,
): number {
  const base = labelSize === "SMALL" ? 17 : 23;
  return Math.round(base * textScale(titleSize));
}

export function priceFontPx(
  priceSize: QrLabelTextSize,
  labelSize: QrLabelSize,
): number {
  const base = labelSize === "SMALL" ? 15 : 19;
  return Math.round(base * textScale(priceSize));
}

/** Vertical barcode text beside the QR. */
export function codeFontPx(labelSize: QrLabelSize): number {
  return labelSize === "SMALL" ? 14 : 18;
}

export function ellipsizeText(
  measure: (text: string) => number,
  text: string,
  maxWidth: number,
  mode: "end" | "middle",
): string {
  if (measure(text) <= maxWidth) return text;
  if (mode === "end") {
    const ellipsis = "…";
    let low = 0;
    let high = text.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      const candidate = `${text.slice(0, mid)}${ellipsis}`;
      if (measure(candidate) <= maxWidth) low = mid;
      else high = mid - 1;
    }
    return low <= 0 ? ellipsis : `${text.slice(0, low)}${ellipsis}`;
  }
  const ellipsis = "…";
  if (measure(ellipsis) > maxWidth) return ellipsis;
  let left = 1;
  let right = 1;
  while (left + right < text.length) {
    const nextLeft = left + 1;
    const candidate = `${text.slice(0, nextLeft)}${ellipsis}${text.slice(-right)}`;
    if (measure(candidate) <= maxWidth) {
      left = nextLeft;
      continue;
    }
    const nextRight = right + 1;
    const candidate2 = `${text.slice(0, left)}${ellipsis}${text.slice(-nextRight)}`;
    if (measure(candidate2) <= maxWidth) {
      right = nextRight;
      continue;
    }
    break;
  }
  return `${text.slice(0, left)}${ellipsis}${text.slice(-right)}`;
}

export type QrMatrixLayout = {
  /** Dark modules [row][col]. */
  dark: boolean[][];
  n: number;
  modulePx: number;
  side: number;
  quiet: number;
};

export function layoutQrMatrix(
  payload: string,
  maxSidePx: number,
  minModulePx = MIN_QR_MODULE_PX,
): QrMatrixLayout {
  const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const matrix = qr.modules;
  const n = matrix.size;
  const totalModules = n + QR_QUIET_MODULES * 2;
  const modulePx = Math.max(
    minModulePx,
    Math.floor(Math.max(1, maxSidePx) / totalModules),
  );
  const side = modulePx * totalModules;
  const dark: boolean[][] = [];
  for (let row = 0; row < n; row += 1) {
    const line: boolean[] = [];
    for (let col = 0; col < n; col += 1) {
      line.push(Boolean(matrix.get(row, col)));
    }
    dark.push(line);
  }
  return {
    dark,
    n,
    modulePx,
    side,
    quiet: QR_QUIET_MODULES,
  };
}

export type StickerTextBlock = {
  text: string;
  /**
   * Anchor x/y in sticker space.
   * rotationDeg === 0 → alphabetic baseline at (x, y), text centered on x.
   * rotationDeg === 270 → middle baseline at (x, y), text rotated clockwise 270°.
   */
  x: number;
  y: number;
  fontPx: number;
  fontWeight: "bold" | "normal";
  /** SVG/CSS clockwise degrees. Barcode text uses 270 (vertical beside QR). */
  rotationDeg: number;
  /** Extra space between characters (barcode text only). */
  letterSpacingPx?: number;
};

export type StickerLayout = {
  /** Reference units (= 203 DPI pixels when dpi === 203). */
  width: number;
  height: number;
  dpi: number;
  widthMm: number;
  heightMm: number;
  title: StickerTextBlock | null;
  qr: QrMatrixLayout & { left: number; top: number };
  code: StickerTextBlock | null;
  price: StickerTextBlock | null;
};

function createMeasure(
  fontPx: number,
  fontWeight: "bold" | "normal",
  letterSpacingPx = 0,
): (text: string) => number {
  const baseMeasure = (() => {
    if (typeof document === "undefined") {
      const factor = fontWeight === "bold" ? 0.62 : 0.55;
      return (text: string) => text.length * fontPx * factor;
    }
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      const factor = fontWeight === "bold" ? 0.62 : 0.55;
      return (text: string) => text.length * fontPx * factor;
    }
    ctx.font = `${fontWeight} ${fontPx}px Arial, Helvetica, sans-serif`;
    return (text: string) => ctx.measureText(text).width;
  })();

  if (letterSpacingPx <= 0) return baseMeasure;
  return (text: string) => {
    if (text.length <= 1) return baseMeasure(text);
    return baseMeasure(text) + letterSpacingPx * (text.length - 1);
  };
}

/**
 * Compute sticker geometry in DPI-scaled reference units.
 * Default dpi=203 matches TSC TE210 native dots / SVG viewBox.
 */
export function computeStickerLayout(
  model: QrStickerModel,
  preferences: QrLabelPreferences,
  dpi = QR_LABEL_DEFAULT_DPI,
): StickerLayout {
  const dpiScale = dpi / QR_LABEL_DEFAULT_DPI;
  const { widthMm, heightMm } = labelSizeMm(preferences.labelSize);
  const width = mmToPx(widthMm, dpi);
  const height = mmToPx(heightMm, dpi);

  const padding = Math.max(4, Math.round(width * 0.04));
  const bottomLimit = height - padding;
  const contentWidth = width - padding * 2;
  // Extra gap so larger fonts never collide with the QR.
  const gap = Math.max(3, Math.round(padding * 0.28));

  const titleSizePx = Math.max(
    1,
    Math.round(titleFontPx(preferences.titleSize, preferences.labelSize) * dpiScale),
  );
  const codeSizePx = Math.max(
    1,
    Math.round(codeFontPx(preferences.labelSize) * dpiScale),
  );
  const priceSizePx = Math.max(
    1,
    Math.round(priceFontPx(preferences.priceSize, preferences.labelSize) * dpiScale),
  );

  const titleHeight = preferences.showTitle ? Math.ceil(titleSizePx * 1.2) : 0;
  const priceHeight = preferences.showPrice ? Math.ceil(priceSizePx * 1.2) : 0;
  // Wide enough strip so rotated glyphs clear the QR edge.
  const codeStripWidth = preferences.showCodeText
    ? Math.ceil(codeSizePx * 1.45)
    : 0;

  const titleGap = preferences.showTitle ? gap : 0;
  const priceGap = preferences.showPrice ? gap : 0;
  const codeGap = preferences.showCodeText ? Math.max(gap, Math.round(codeSizePx * 0.35)) : 0;

  const reservedVertical =
    titleHeight + titleGap + priceHeight + priceGap;
  const midAvailableH = Math.max(
    Math.round(MIN_QR_MODULE_PX * 10 * dpiScale),
    bottomLimit - padding - reservedVertical,
  );
  const midAvailableW = Math.max(
    Math.round(MIN_QR_MODULE_PX * 10 * dpiScale),
    contentWidth - codeStripWidth - codeGap,
  );

  // Slightly larger QR than the conservative 0.70/0.56 baseline; still below the earlier max.
  const maxQrRatio = preferences.labelSize === "SMALL" ? 0.78 : 0.66;
  const maxQrSide = Math.max(
    Math.round(MIN_QR_MODULE_PX * 10 * dpiScale),
    Math.floor(
      Math.min(midAvailableW, midAvailableH, height * maxQrRatio),
    ),
  );
  const minModulePx = Math.max(
    MIN_QR_MODULE_PX,
    Math.round(MIN_QR_MODULE_PX * dpiScale),
  );
  const qrMatrix = layoutQrMatrix(model.barcode, maxQrSide, minModulePx);
  const qrSide = qrMatrix.side;

  const midBandWidth = qrSide + codeGap + codeStripWidth;
  const midBandHeight = qrSide;
  const totalContentHeight =
    titleHeight + titleGap + midBandHeight + priceGap + priceHeight;
  let top =
    padding +
    Math.max(0, Math.floor((bottomLimit - padding - totalContentHeight) / 2));

  const centerX = width / 2;
  // Leave a small inset so ellipsized text never touches the label edge.
  const textMaxWidth = Math.max(8, contentWidth - 2);

  let title: StickerTextBlock | null = null;
  if (preferences.showTitle) {
    const raw = model.productName.trim() || "—";
    const measure = createMeasure(titleSizePx, "bold");
    const text = ellipsizeText(measure, raw, textMaxWidth, "end");
    title = {
      text,
      x: centerX,
      y: top + titleSizePx * 0.82,
      fontPx: titleSizePx,
      fontWeight: "bold",
      rotationDeg: 0,
    };
    top += titleHeight + titleGap;
  }

  const midLeft = Math.round((width - midBandWidth) / 2);
  const qrLeft = midLeft;
  const qrTop = Math.round(top);

  let code: StickerTextBlock | null = null;
  if (preferences.showCodeText) {
    const raw = formatBarcodeText(model.barcode);
    // Small tracking so bold vertical glyphs don’t collide when printed.
    const letterSpacingPx = Math.max(1, Math.round(codeSizePx * 0.1));
    const measure = createMeasure(codeSizePx, "bold", letterSpacingPx);
    // Keep vertical text inside the QR height with end padding.
    const codeMaxAdvance = Math.max(8, Math.floor(qrSide * 0.9));
    const text = ellipsizeText(measure, raw, codeMaxAdvance, "middle");
    const codeCx = midLeft + qrSide + codeGap + codeStripWidth / 2;
    const codeCy = qrTop + qrSide / 2;
    code = {
      text,
      x: codeCx,
      y: codeCy,
      fontPx: codeSizePx,
      fontWeight: "bold",
      rotationDeg: 270,
      letterSpacingPx,
    };
  }

  top = qrTop + qrSide + priceGap;

  let price: StickerTextBlock | null = null;
  if (preferences.showPrice) {
    const raw =
      model.sellingPrice != null ? formatLabelPrice(model.sellingPrice) : "—";
    const measure = createMeasure(priceSizePx, "bold");
    const text = ellipsizeText(measure, raw, textMaxWidth, "end");
    price = {
      text,
      x: centerX,
      y: top + priceSizePx * 0.82,
      fontPx: priceSizePx,
      fontWeight: "bold",
      rotationDeg: 0,
    };
  }

  return {
    width,
    height,
    dpi,
    widthMm,
    heightMm,
    title,
    qr: { ...qrMatrix, left: qrLeft, top: qrTop },
    code,
    price,
  };
}
