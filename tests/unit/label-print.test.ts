import { describe, expect, it } from "vitest";

import {
  copiesFor,
  expandItemsToLabels,
  formatBarcodeText,
  formatLabelPrice,
  summarizeLabelPrint,
} from "@/utils/label-print";
import {
  chunkIntoRows,
  getQrLabelLayoutConfig,
  padLabelsToColumns,
} from "@/utils/qr-label-layout";
import { DEFAULT_QR_LABEL_PREFERENCES } from "@/utils/qr-label-preferences";

describe("copiesFor", () => {
  it("uses fixed copies when mode is FIXED", () => {
    expect(
      copiesFor(25, { copiesMode: "FIXED", fixedCopies: 2 }),
    ).toBe(2);
  });

  it("uses ceil(quantity) when USE_PURCHASE_QTY", () => {
    expect(
      copiesFor(5, { copiesMode: "USE_PURCHASE_QTY", fixedCopies: 1 }),
    ).toBe(5);
    expect(
      copiesFor(5.2, { copiesMode: "USE_PURCHASE_QTY", fixedCopies: 1 }),
    ).toBe(6);
  });
});

describe("expandItemsToLabels", () => {
  it("expands by purchase quantity", () => {
    const result = expandItemsToLabels(
      [
        {
          productId: "a",
          productName: "Mango",
          barcode: "PABC123456",
          quantity: 3,
          sellingPrice: 40,
        },
      ],
      { ...DEFAULT_QR_LABEL_PREFERENCES, copiesMode: "USE_PURCHASE_QTY" },
    );
    expect(result.totalStickers).toBe(3);
    expect(result.models).toHaveLength(1);
  });

  it("uses fixed copies per item", () => {
    const result = expandItemsToLabels(
      [
        {
          productId: "a",
          productName: "Mango",
          barcode: "PABC",
          quantity: 10,
        },
      ],
      {
        ...DEFAULT_QR_LABEL_PREFERENCES,
        copiesMode: "FIXED",
        fixedCopies: 2,
      },
    );
    expect(result.totalStickers).toBe(2);
  });

  it("skips missing barcodes", () => {
    const result = expandItemsToLabels(
      [
        {
          productId: "a",
          productName: "No Code",
          barcode: null,
          quantity: 2,
        },
        {
          productId: "c",
          productName: "Ok",
          barcode: "PY",
          quantity: 1,
        },
      ],
      { ...DEFAULT_QR_LABEL_PREFERENCES, copiesMode: "USE_PURCHASE_QTY" },
    );
    expect(result.totalStickers).toBe(1);
    expect(result.skippedNoBarcode).toHaveLength(1);
    expect(summarizeLabelPrint(result)).toContain("skipped");
  });
});

describe("formatBarcodeText", () => {
  it("strips AUTO prefix like Android", () => {
    expect(formatBarcodeText("AUTO123")).toBe("123");
  });
});

describe("formatLabelPrice", () => {
  it("matches Android formatRupee for whole amounts", () => {
    expect(formatLabelPrice(480)).toBe("₹480");
  });
});

describe("getQrLabelLayoutConfig", () => {
  it("uses 4 columns for 25×25", () => {
    const layout = getQrLabelLayoutConfig("SMALL");
    expect(layout).toMatchObject({
      labelWidth: 25,
      labelHeight: 25,
      columns: 4,
      pageWidthMm: 100,
      pageHeightMm: 25,
    });
  });

  it("uses 2 columns for 50×30", () => {
    const layout = getQrLabelLayoutConfig("LARGE");
    expect(layout).toMatchObject({
      labelWidth: 50,
      labelHeight: 30,
      columns: 2,
      pageWidthMm: 100,
      pageHeightMm: 30,
    });
  });
});

describe("padLabelsToColumns / chunkIntoRows", () => {
  it("pads incomplete last row for 4 columns", () => {
    const padded = padLabelsToColumns([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4);
    expect(padded).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, null, null]);
    expect(chunkIntoRows(padded, 4)).toEqual([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, null, null],
    ]);
  });

  it("pads incomplete last row for 2 columns", () => {
    const padded = padLabelsToColumns([1, 2, 3, 4, 5], 2);
    expect(chunkIntoRows(padded, 2)).toEqual([
      [1, 2],
      [3, 4],
      [5, null],
    ]);
  });
});

describe("203 DPI label pixel sizes", () => {
  it("maps 25×25 mm to integer TE210 dots", async () => {
    const { mmToPx, QR_LABEL_DEFAULT_DPI, QR_LABEL_PREVIEW_DPI } = await import(
      "@/utils/qr-label-preferences"
    );
    expect(QR_LABEL_DEFAULT_DPI).toBe(203);
    expect(QR_LABEL_PREVIEW_DPI).toBe(609);
    expect(mmToPx(25, 203)).toBe(200);
    expect(mmToPx(25, 609)).toBe(599);
    expect(mmToPx(50, 203)).toBe(400);
    expect(mmToPx(30, 203)).toBe(240);
  });
});

describe("computeStickerLayout / SVG print", () => {
  it("keeps 25×25 layout units at 203 DPI", async () => {
    const { computeStickerLayout } = await import("@/utils/qr-sticker-layout");
    const { renderQrStickerSvg } = await import("@/utils/qr-sticker-svg");
    const { DEFAULT_QR_LABEL_PREFERENCES } = await import(
      "@/utils/qr-label-preferences"
    );
    const model = {
      productId: "1",
      productName: "Mango Pickle",
      barcode: "PABC123456",
      sellingPrice: 40,
      mrp: null,
      quantity: 1,
    };
    const layout = computeStickerLayout(
      model,
      { ...DEFAULT_QR_LABEL_PREFERENCES, labelSize: "SMALL" },
      203,
    );
    expect(layout.width).toBe(200);
    expect(layout.height).toBe(200);
    expect(layout.qr.modulePx).toBeGreaterThanOrEqual(2);
    if (layout.code) {
      expect(layout.code.rotationDeg).toBe(270);
      // Code sits to the right of the QR.
      expect(layout.code.x).toBeGreaterThan(layout.qr.left + layout.qr.side);
    }
    const svg = renderQrStickerSvg(
      model,
      { ...DEFAULT_QR_LABEL_PREFERENCES, labelSize: "SMALL" },
      203,
    );
    expect(svg).toContain('width="25mm"');
    expect(svg).toContain('height="25mm"');
    expect(svg).toContain("viewBox=");
    expect(svg).toContain("<text ");
    expect(svg).toContain("rotate(270");
    expect(svg).toContain('shape-rendering="crispEdges"');
  });
});
