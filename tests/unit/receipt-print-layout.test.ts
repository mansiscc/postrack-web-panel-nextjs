import { describe, expect, it } from "vitest";

import { shouldShowReceiptLogo } from "@/utils/receipt-preview-data";
import {
  estimateReceiptPageHeightMm,
  getReceiptPrintLayout,
} from "@/utils/receipt-print-layout";
import {
  buildReceiptText,
  formatMoneyForPrint,
  formatQuantity,
  getReceiptTextLayout,
} from "@/utils/receipt-text-formatter";

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

  it("maps 76mm roll to 68mm printable width", () => {
    const layout = getReceiptPrintLayout("76mm");
    expect(layout.paperWidthMm).toBe(76);
    expect(layout.printableWidthMm).toBe(68);
    expect(layout.charactersPerLine).toBe(44);
    expect(layout.sideMarginMm).toBe(4);
  });

  it("sizes page height from line count, not A4", () => {
    const short = estimateReceiptPageHeightMm({
      lineCount: 12,
    });
    const withLogo = estimateReceiptPageHeightMm({
      lineCount: 12,
      hasLogo: true,
    });
    const tall = estimateReceiptPageHeightMm({
      lineCount: 40,
      hasLogo: true,
    });
    expect(short).toBeGreaterThanOrEqual(60);
    expect(short).toBeLessThan(297);
    expect(withLogo).toBeGreaterThan(short);
    expect(tall).toBeGreaterThan(withLogo);
    expect(tall).toBeLessThanOrEqual(500);
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

describe("receipt text formatter (Android parity)", () => {
  it("formats money like Android print helper", () => {
    expect(formatMoneyForPrint(799)).toBe("799");
    expect(formatMoneyForPrint(55.5)).toBe("55.5");
    expect(formatMoneyForPrint(1234.56)).toBe("1,234.56");
    expect(formatQuantity(5)).toBe("5");
    expect(formatQuantity(5.25)).toBe("5.25");
  });

  it("builds Android-style columns and sections on 80mm", () => {
    const text = buildReceiptText(
      {
        businessName: "Demo Store",
        businessAddress: "Main Road",
        businessPhone: "9876543210",
        businessGstin: "22AAAAA0000A1Z5",
        billNumber: "INV-1",
        createdAt: "2026-08-13T10:30:00.000Z",
        customerName: "Ravi",
        customerPhone: "9999999999",
        items: [
          {
            name: "Tea",
            quantity: 2,
            unitPrice: 20,
            rowTotal: 40,
            mrp: 25,
          },
        ],
        subtotal: 40,
        otherItemsAmount: 10,
        discountAmount: 5,
        totalAmount: 45,
        paidAmount: 40,
        receiptFooter: "Thank you",
      },
      "80mm",
    );

    expect(text).toContain("Demo Store");
    expect(text).toContain("Ph: 9876543210");
    expect(text).toContain("GSTIN: 22AAAAA0000A1Z5");
    expect(text).toContain("BN: INV-1");
    expect(text).toContain("Customer: Ravi-9999999999");
    expect(text).toContain("Item");
    expect(text).toContain("Rate");
    expect(text).toContain("Other Items");
    expect(text).toContain("Subtotal");
    expect(text).toContain("Discount");
    expect(text).toContain("TOTAL");
    expect(text).toContain("Paid Amount");
    expect(text).toContain("Remaining");
    expect(text).toContain("Saved Rs.");
    expect(text).toContain("Thank you");
    expect(text).not.toContain("Payment:");
    expect(text).not.toContain("Status:");
  });

  it("uses 32-char width for 58mm", () => {
    const text = buildReceiptText(
      {
        businessName: "Shop",
        billNumber: "1",
        items: [{ name: "Item", quantity: 1, unitPrice: 10, rowTotal: 10 }],
        subtotal: 10,
        discountAmount: 0,
        totalAmount: 10,
        paidAmount: 10,
      },
      "58mm",
    );
    const divider = text.split("\n").find((line) => line.startsWith("-"));
    expect(divider?.length).toBe(32);
  });

  it("matches Android ReceiptLayout column widths per paper size", () => {
    expect(getReceiptTextLayout("58mm")).toMatchObject({
      lineWidth: 32,
      itemColWidth: 8,
      qtyColWidth: 3,
      rateColWidth: 7,
      amountColWidth: 8,
    });
    expect(getReceiptTextLayout("76mm")).toMatchObject({
      lineWidth: 44,
      itemColWidth: 21,
      qtyColWidth: 3,
      rateColWidth: 7,
      amountColWidth: 8,
    });
    expect(getReceiptTextLayout("80mm")).toMatchObject({
      lineWidth: 48,
      itemColWidth: 24,
      qtyColWidth: 3,
      rateColWidth: 7,
      amountColWidth: 8,
    });
  });

  it("widens Item column on larger rolls (header row)", () => {
    const sample = {
      businessName: "Shop",
      billNumber: "1",
      items: [
        {
          name: "LongProductNameHere",
          quantity: 1,
          unitPrice: 10,
          rowTotal: 10,
        },
      ],
      subtotal: 10,
      discountAmount: 0,
      totalAmount: 10,
      paidAmount: 10,
    };

    const header58 = buildReceiptText(sample, "58mm")
      .split("\n")
      .find((line) => line.includes("Item") && line.includes("Qty"));
    const header80 = buildReceiptText(sample, "80mm")
      .split("\n")
      .find((line) => line.includes("Item") && line.includes("Qty"));

    expect(header58?.startsWith("Item    ")).toBe(true); // 8-char Item col
    expect(header80?.startsWith("Item")).toBe(true);
    expect(header80!.indexOf("Qty")).toBeGreaterThan(header58!.indexOf("Qty"));
  });
});
