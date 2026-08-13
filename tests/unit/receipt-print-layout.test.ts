import { describe, expect, it } from "vitest";

import { shouldShowReceiptLogo } from "@/utils/receipt-preview-data";
import {
  estimateReceiptPageHeightMm,
  getReceiptPrintLayout,
} from "@/utils/receipt-print-layout";

describe("receipt print layout (Android PrinterPaperSize)", () => {
  it("maps 80mm roll to 72mm printable width", () => {
    const layout = getReceiptPrintLayout("80mm");
    expect(layout.paperWidthMm).toBe(80);
    expect(layout.printableWidthMm).toBe(72);
    expect(layout.charactersPerLine).toBe(48);
    expect(layout.sideMarginMm).toBe(4);
  });

  it("maps 58mm roll to 48mm printable width", () => {
    const layout = getReceiptPrintLayout("58mm");
    expect(layout.paperWidthMm).toBe(58);
    expect(layout.printableWidthMm).toBe(48);
    expect(layout.charactersPerLine).toBe(32);
    expect(layout.sideMarginMm).toBe(5);
  });

  it("sizes page height from content, not A4", () => {
    const short = estimateReceiptPageHeightMm({
      itemCount: 1,
      hasOtherItems: false,
      hasDiscount: false,
      hasFooter: false,
      hasPhone: false,
      hasStatus: false,
    });
    const withLogo = estimateReceiptPageHeightMm({
      itemCount: 1,
      hasOtherItems: false,
      hasDiscount: false,
      hasFooter: false,
      hasPhone: false,
      hasStatus: false,
      hasLogo: true,
    });
    const tall = estimateReceiptPageHeightMm({
      itemCount: 20,
      hasOtherItems: true,
      hasDiscount: true,
      hasFooter: true,
      hasPhone: true,
      hasStatus: true,
      hasLogo: true,
    });
    expect(short).toBeGreaterThanOrEqual(70);
    expect(short).toBeLessThan(297);
    expect(withLogo).toBeGreaterThan(short);
    expect(tall).toBeGreaterThan(withLogo);
    expect(tall).toBeLessThanOrEqual(400);
  });
});

describe("shouldShowReceiptLogo", () => {
  it("requires both toggle and logo url", () => {
    expect(
      shouldShowReceiptLogo({
        showLogoOnBill: true,
        logoUrl: "https://x/a.png",
      }),
    ).toBe(true);
    expect(
      shouldShowReceiptLogo({
        showLogoOnBill: false,
        logoUrl: "https://x/a.png",
      }),
    ).toBe(false);
    expect(shouldShowReceiptLogo({ showLogoOnBill: true, logoUrl: "  " })).toBe(
      false,
    );
    expect(shouldShowReceiptLogo({ showLogoOnBill: true, logoUrl: null })).toBe(
      false,
    );
  });
});
