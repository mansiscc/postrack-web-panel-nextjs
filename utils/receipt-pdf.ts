/**
 * Minimal monospace PDF writer (Courier) — mirrors Android ReceiptVisualRenderer
 * without adding a PDF library dependency.
 */

export type ReceiptPdfLineStyle = "title" | "emph" | "normal";

export type ReceiptPdfLine = {
  text: string;
  style?: ReceiptPdfLineStyle;
};

function escapePdfText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function pdfString(value: string): string {
  return `(${escapePdfText(value)})`;
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** Courier advance ≈ 0.6em */
function measureCourier(text: string, fontPt: number): number {
  return text.length * fontPt * 0.6;
}

/**
 * Build a PDF of monospace receipt lines.
 * Sizes match Android PDF share: body 8.5pt, title 11.5pt.
 */
export function buildMonospaceReceiptPdf(
  lines: ReceiptPdfLine[],
  options?: {
    bodyFontPt?: number;
    titleFontPt?: number;
    marginPt?: number;
    lineGapPt?: number;
    maxPageHeightPt?: number;
  },
): Blob {
  const bodyFontPt = options?.bodyFontPt ?? 8.5;
  const titleFontPt = options?.titleFontPt ?? 11.5;
  const marginPt = options?.marginPt ?? 20;
  const lineGapPt = options?.lineGapPt ?? 2;
  const maxPageHeightPt = options?.maxPageHeightPt ?? 1000;

  const safeLines = lines.length ? lines : [{ text: " " as string }];

  type Styled = {
    text: string;
    fontPt: number;
    bold: boolean;
    center: boolean;
    lineHeight: number;
    width: number;
  };

  const styled: Styled[] = safeLines.map((line) => {
    const style = line.style ?? "normal";
    const fontPt = style === "title" ? titleFontPt : bodyFontPt;
    const bold = style === "title" || style === "emph";
    const text = line.text.length ? line.text : " ";
    const center = style === "title";
    return {
      text,
      fontPt,
      bold,
      center,
      lineHeight: fontPt * 1.15 + lineGapPt,
      width: measureCourier(text.trim(), fontPt),
    };
  });

  const maxContentWidth = Math.max(...styled.map((s) => s.width), 72);
  const pageWidth = Math.min(
    612,
    Math.max(180, Math.ceil(maxContentWidth + marginPt * 2)),
  );

  const pages: Styled[][] = [];
  let chunk: Styled[] = [];
  let chunkHeight = 0;
  const innerMax = maxPageHeightPt - marginPt * 2;
  for (const row of styled) {
    if (chunk.length > 0 && chunkHeight + row.lineHeight > innerMax) {
      pages.push(chunk);
      chunk = [];
      chunkHeight = 0;
    }
    chunk.push(row);
    chunkHeight += row.lineHeight;
  }
  if (chunk.length) pages.push(chunk);

  const objectBodies: string[] = [""]; // index 0 unused

  const fontRegularId = 1;
  const fontBoldId = 2;
  objectBodies.push(
    `${fontRegularId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n`,
  );
  objectBodies.push(
    `${fontBoldId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>\nendobj\n`,
  );

  const pageIds: number[] = [];
  for (const pageLines of pages) {
    const pageHeight = Math.min(
      maxPageHeightPt,
      Math.max(
        120,
        Math.ceil(
          pageLines.reduce((sum, row) => sum + row.lineHeight, 0) + marginPt * 2,
        ),
      ),
    );

    const ops: string[] = ["BT"];
    let y = pageHeight - marginPt - pageLines[0]!.fontPt;
    for (const row of pageLines) {
      const fontName = row.bold ? "/F2" : "/F1";
      ops.push(`${fontName} ${row.fontPt} Tf`);
      const drawText = row.center ? row.text.trim() : row.text;
      const x = row.center
        ? Math.max(
            marginPt,
            (pageWidth - measureCourier(drawText, row.fontPt)) / 2,
          )
        : marginPt;
      ops.push(`1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`);
      ops.push(`${pdfString(drawText)} Tj`);
      y -= row.lineHeight;
    }
    ops.push("ET");
    const stream = ops.join("\n");
    const contentId = objectBodies.length;
    objectBodies.push(
      `${contentId} 0 obj\n<< /Length ${utf8Length(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
    );
    const pageId = objectBodies.length;
    objectBodies.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> >>\nendobj\n`,
    );
    pageIds.push(pageId);
  }

  const pagesId = objectBodies.length;
  objectBodies.push(
    `${pagesId} 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>\nendobj\n`,
  );

  for (const pageId of pageIds) {
    objectBodies[pageId] = objectBodies[pageId]!.replace(
      "/Parent 0 0 R",
      `/Parent ${pagesId} 0 R`,
    );
  }

  const catalogId = objectBodies.length;
  objectBodies.push(
    `${catalogId} 0 obj\n<< /Type /Catalog /Pages ${pagesId} 0 R >>\nendobj\n`,
  );

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let i = 1; i < objectBodies.length; i += 1) {
    offsets[i] = utf8Length(pdf);
    pdf += objectBodies[i]!;
  }

  const xrefStart = utf8Length(pdf);
  pdf += `xref\n0 ${objectBodies.length}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < objectBodies.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objectBodies.length} /Root ${catalogId} 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

/** Style receipt text lines for PDF (Android PDF emphasis rules). */
export function styleReceiptLinesForPdf(
  lines: string[],
  businessName: string,
): ReceiptPdfLine[] {
  const bn = businessName.trim();
  return lines.map((text) => {
    const trimmed = text.trim();
    if (bn && trimmed === bn) return { text, style: "title" as const };
    if (
      trimmed.startsWith("TOTAL") ||
      trimmed.startsWith("Paid Amount") ||
      trimmed.startsWith("Remaining") ||
      (trimmed.startsWith("** Saved Rs.") && trimmed.endsWith(" on MRP **"))
    ) {
      return { text, style: "emph" as const };
    }
    return { text, style: "normal" as const };
  });
}
