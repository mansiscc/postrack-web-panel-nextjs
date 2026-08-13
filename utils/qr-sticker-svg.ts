/**
 * Vector SVG sticker markup for Chrome print documents.
 * Physical size is set in mm; viewBox uses 203-DPI reference units.
 */

import type { QrStickerModel } from "@/utils/label-print";
import {
  computeStickerLayout,
  type StickerLayout,
  type StickerTextBlock,
} from "@/utils/qr-sticker-layout";
import {
  QR_LABEL_DEFAULT_DPI,
  type QrLabelPreferences,
} from "@/utils/qr-label-preferences";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function svgText(block: StickerTextBlock): string {
  const rotated = block.rotationDeg !== 0;
  const anchor = "middle";
  const baseline = rotated ? "middle" : "alphabetic";
  const transform = rotated
    ? ` transform="rotate(${block.rotationDeg} ${block.x} ${block.y})"`
    : "";
  const spacing =
    block.letterSpacingPx && block.letterSpacingPx > 0
      ? ` letter-spacing="${block.letterSpacingPx}"`
      : "";
  const weight = block.fontWeight === "bold" ? 700 : 400;
  return `<text x="${block.x}" y="${block.y}" text-anchor="${anchor}" dominant-baseline="${baseline}" fill="#000000" font-family="Arial, Helvetica, sans-serif" font-weight="${weight}" font-size="${block.fontPx}"${spacing}${transform}>${escapeXml(block.text)}</text>`;
}

/** Square QR modules as SVG rects (shape-rendering keeps edges crisp). */
function svgQrModules(layout: StickerLayout): string {
  const { qr } = layout;
  const parts: string[] = [
    `<g transform="translate(${qr.left},${qr.top})" shape-rendering="crispEdges">`,
    `<rect x="0" y="0" width="${qr.side}" height="${qr.side}" fill="#ffffff"/>`,
  ];
  for (let row = 0; row < qr.n; row += 1) {
    for (let col = 0; col < qr.n; col += 1) {
      if (!qr.dark[row]?.[col]) continue;
      const x = (col + qr.quiet) * qr.modulePx;
      const y = (row + qr.quiet) * qr.modulePx;
      parts.push(
        `<rect x="${x}" y="${y}" width="${qr.modulePx}" height="${qr.modulePx}" fill="#000000"/>`,
      );
    }
  }
  parts.push("</g>");
  return parts.join("");
}

/**
 * One label as SVG. width/height attributes use mm; viewBox = native layout units.
 */
export function renderQrStickerSvg(
  model: QrStickerModel,
  preferences: QrLabelPreferences,
  dpi = QR_LABEL_DEFAULT_DPI,
): string {
  const layout = computeStickerLayout(model, preferences, dpi);
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.widthMm}mm" height="${layout.heightMm}mm" viewBox="0 0 ${layout.width} ${layout.height}" preserveAspectRatio="xMidYMid meet">`,
    `<rect width="${layout.width}" height="${layout.height}" fill="#ffffff"/>`,
  ];
  if (layout.title) parts.push(svgText(layout.title));
  parts.push(svgQrModules(layout));
  if (layout.code) parts.push(svgText(layout.code));
  if (layout.price) parts.push(svgText(layout.price));
  parts.push("</svg>");
  return parts.join("");
}
