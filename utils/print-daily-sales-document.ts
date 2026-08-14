import { printHtmlDocument } from "@/utils/print-label-document";
import {
  buildDailySalesReceiptLines,
  dailySalesLineStyle,
  type DailySalesReceiptItem,
} from "@/utils/daily-sales-receipt-formatter";
import {
  readPrintSettings,
  type ReceiptPaperWidth,
} from "@/utils/print-settings";
import {
  estimateReceiptPageHeightMm,
  getReceiptPrintLayout,
} from "@/utils/receipt-print-layout";
import {
  RECEIPT_MONO_FONT,
  RECEIPT_MONO_FONT_STYLESHEET,
  padReceiptLine,
} from "@/utils/receipt-render";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function printDailySalesDocument(input: {
  businessName: string;
  dateIso: string;
  items: DailySalesReceiptItem[];
  paperWidth?: ReceiptPaperWidth;
}): Promise<void> {
  const paperWidth = input.paperWidth ?? readPrintSettings().paperWidth;
  const layout = getReceiptPrintLayout(paperWidth);
  const businessName = input.businessName.trim();
  const lines = buildDailySalesReceiptLines({
    businessName,
    dateIso: input.dateIso,
    items: input.items,
    paperWidth,
  });
  const pageHeightMm = estimateReceiptPageHeightMm({
    lineCount: lines.length,
    hasLogo: false,
  });
  const chars = layout.charactersPerLine;
  const bodyFontMm =
    layout.printableWidthMm / (layout.charactersPerLine * 0.6);
  const titleFontMm = bodyFontMm * (layout.titleFontPt / layout.bodyFontPt);

  const bodyHtml = lines
    .map((line) => {
      const style = dailySalesLineStyle(line, businessName);
      if (style === "title") {
        return `<div class="title">${escapeHtml(businessName)}</div>`;
      }
      const content = escapeHtml(padReceiptLine(line, chars)).replaceAll(
        " ",
        "&nbsp;",
      );
      const cls = style === "emph" ? "line emph" : "line";
      return `<div class="${cls}">${content}</div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Daily Sales · ${layout.paperWidthMm}mm</title>
  <link rel="stylesheet" href="${RECEIPT_MONO_FONT_STYLESHEET}" />
  <style>
    @page {
      size: ${layout.paperWidthMm}mm ${pageHeightMm}mm;
      margin: 0;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: ${layout.paperWidthMm}mm;
      height: auto;
      background: #fff;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      overflow: hidden;
    }
    * { box-sizing: border-box; }
    .receipt {
      width: ${layout.paperWidthMm}mm;
      padding: 2mm ${layout.sideMarginMm}mm;
      color: #000;
      background: #fff;
      overflow: hidden;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .receipt-inner {
      width: ${layout.printableWidthMm}mm;
      max-width: 100%;
      overflow: hidden;
    }
    .receipt-text {
      width: ${layout.printableWidthMm}mm;
      max-width: 100%;
      font-family: ${RECEIPT_MONO_FONT};
      font-size: ${bodyFontMm}mm;
      line-height: 1.25;
      font-variant-ligatures: none;
      font-kerning: none;
      font-synthesis: none;
      font-feature-settings: "tnum";
      color: #000;
      overflow: hidden;
    }
    .receipt-text .title {
      text-align: center;
      font-size: ${titleFontMm}mm;
      font-weight: 700;
      white-space: normal;
      width: 100%;
      overflow: hidden;
    }
    .receipt-text .line {
      white-space: pre;
      width: ${layout.printableWidthMm}mm;
      max-width: 100%;
      overflow: hidden;
      font-size: ${bodyFontMm}mm;
      font-weight: 400;
      box-sizing: border-box;
    }
    .receipt-text .line.emph {
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="receipt" id="receipt-root">
    <div class="receipt-inner">
      <div class="receipt-text">${bodyHtml}</div>
    </div>
  </div>
</body>
</html>`;

  await printHtmlDocument(html, {
    layoutWidthMm: layout.paperWidthMm,
    paperWidthMm: layout.paperWidthMm,
    measureSelector: "#receipt-root",
  });
}
