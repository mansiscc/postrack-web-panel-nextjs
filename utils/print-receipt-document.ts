import { formatCurrency } from "@/utils/currency";
import { formatDateTime } from "@/utils/date";
import { printHtmlDocument } from "@/utils/print-label-document";
import {
  readPrintSettings,
  type ReceiptPaperWidth,
} from "@/utils/print-settings";
import {
  shouldShowReceiptLogo,
  type ReceiptPreviewData,
} from "@/utils/receipt-preview-data";
import {
  estimateReceiptPageHeightMm,
  getReceiptPrintLayout,
} from "@/utils/receipt-print-layout";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Print a thermal receipt via isolated iframe (same pattern as QR labels).
 *
 * Page size follows Android `PrinterPaperSize`:
 * - `@page` = roll width (58/80mm) × content height
 * - content = printable width (48/72mm) with side margins
 */
export async function printReceiptDocument(
  data: ReceiptPreviewData,
  paperWidth: ReceiptPaperWidth = readPrintSettings().paperWidth,
): Promise<void> {
  const layout = getReceiptPrintLayout(paperWidth);
  const logoSrc = data.logoUrl?.trim() || "";
  const showLogo = shouldShowReceiptLogo(data);
  const pageHeightMm = estimateReceiptPageHeightMm({
    itemCount: data.items.length,
    hasOtherItems: data.otherItemsAmount > 0,
    hasDiscount: data.discountAmount > 0,
    hasFooter: Boolean(data.receiptFooter?.trim()),
    hasPhone: Boolean(data.customerPhone?.trim()),
    hasStatus: Boolean(data.status),
    hasLogo: showLogo,
  });

  const title = escapeHtml(
    data.businessName?.trim() || "POSTrack Receipt",
  );
  const logo = showLogo
    ? `<img class="logo" src="${escapeHtml(logoSrc)}" alt="${title}" />`
    : "";
  const billNumber = data.billNumber
    ? `<div class="muted">${escapeHtml(data.billNumber)}</div>`
    : "";
  const phone = data.customerPhone
    ? `<div>Phone: ${escapeHtml(data.customerPhone)}</div>`
    : "";
  const status = data.status
    ? `<div>Status: ${escapeHtml(data.status)}</div>`
    : "";

  const itemRows = data.items
    .map(
      (item) => `<tr>
        <td class="item">${escapeHtml(item.productName)}</td>
        <td class="qty">${item.quantity}</td>
        <td class="amt">${escapeHtml(formatCurrency(item.rowTotal))}</td>
      </tr>`,
    )
    .join("");

  const otherItems =
    data.otherItemsAmount > 0
      ? `<div class="row"><span>Other items</span><span>${escapeHtml(formatCurrency(data.otherItemsAmount))}</span></div>`
      : "";
  const discount =
    data.discountAmount > 0
      ? `<div class="row"><span>Discount</span><span>-${escapeHtml(formatCurrency(data.discountAmount))}</span></div>`
      : "";
  const footer = data.receiptFooter?.trim()
    ? `<p class="footer">${escapeHtml(data.receiptFooter.trim())}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt · ${layout.paperWidthMm}mm</title>
  <style>
    @page {
      size: ${layout.paperWidthMm}mm ${pageHeightMm}mm;
      margin: 0;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: ${layout.paperWidthMm}mm;
      height: ${pageHeightMm}mm;
      background: #fff;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: ${layout.bodyFontPx}px;
      line-height: 1.35;
    }
    .receipt {
      width: ${layout.paperWidthMm}mm;
      min-height: ${pageHeightMm}mm;
      padding: 2mm ${layout.sideMarginMm}mm;
    }
    .receipt-inner {
      width: ${layout.printableWidthMm}mm;
    }
    .center { text-align: center; }
    .logo {
      display: block;
      margin: 0 auto 2mm;
      max-width: 70%;
      max-height: 16mm;
      width: auto;
      height: auto;
      object-fit: contain;
    }
    .title {
      font-size: ${layout.titleFontPx}px;
      font-weight: 700;
      margin: 0 0 2px;
    }
    .muted { color: #444; font-size: 0.92em; }
    .meta { margin: 6px 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 6px 0;
    }
    th {
      text-align: left;
      font-weight: 600;
      border-bottom: 1px solid #000;
      padding: 2px 0;
    }
    th.qty, td.qty { text-align: center; width: 12%; }
    th.amt, td.amt { text-align: right; width: 28%; }
    td {
      padding: 3px 0;
      border-bottom: 1px dashed #999;
      vertical-align: top;
    }
    td.item { padding-right: 4px; word-break: break-word; }
    .totals { margin-top: 4px; }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin: 2px 0;
    }
    .total {
      border-top: 1px solid #000;
      margin-top: 4px;
      padding-top: 4px;
      font-size: 1.05em;
      font-weight: 700;
    }
    .footer {
      margin: 8px 0 0;
      text-align: center;
      color: #555;
      font-size: 0.85em;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="receipt-inner">
      <div class="center">
        ${logo}
        <h1 class="title">${title}</h1>
        ${billNumber}
        <div class="muted">${escapeHtml(formatDateTime(data.createdAt))}</div>
      </div>

      <div class="meta">
        <div><strong>Customer:</strong> ${escapeHtml(data.customerName)}</div>
        ${phone}
        <div>Payment: ${escapeHtml(data.paymentMode)}</div>
        ${status}
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th class="qty">Qty</th>
            <th class="amt">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <div class="totals">
        <div class="row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(data.subtotal))}</span></div>
        ${otherItems}
        ${discount}
        <div class="row total"><span>Total</span><span>${escapeHtml(formatCurrency(data.totalPayable))}</span></div>
        <div class="row"><span>Received</span><span>${escapeHtml(formatCurrency(data.receivedAmount))}</span></div>
      </div>

      ${footer}
    </div>
  </div>
</body>
</html>`;

  await printHtmlDocument(html);
}
