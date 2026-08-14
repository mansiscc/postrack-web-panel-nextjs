/**
 * Isolated iframe print helper (browser `window.print()`).
 * Used because Postrack web has no ESC/POS bridge like Android POS.
 */

export type PrintHtmlDocumentOptions = {
  /**
   * Give the iframe a real layout width before printing.
   * Required for accurate mm-based thermal receipt layout (0×0 iframes clip/measure wrong).
   */
  layoutWidthMm?: number;
  /**
   * When set with layoutWidthMm, updates `@page` height from measured content
   * so the print dialog stays on one page without side clipping.
   */
  measureSelector?: string;
  paperWidthMm?: number;
};

function waitForDocumentImages(
  doc: Document,
  timeoutMs = 8_000,
): Promise<void> {
  const images = Array.from(doc.images);
  if (images.length === 0) return Promise.resolve();

  return new Promise((resolve) => {
    let remaining = images.length;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const onOne = () => {
      remaining -= 1;
      if (remaining <= 0) done();
    };

    window.setTimeout(done, timeoutMs);

    for (const img of images) {
      if (img.complete) {
        onOne();
        continue;
      }
      img.addEventListener("load", onOne, { once: true });
      img.addEventListener("error", onOne, { once: true });
    }
  });
}

function pxToMm(px: number, doc: Document): number {
  const probe = doc.createElement("div");
  probe.style.width = "100mm";
  probe.style.height = "0";
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  doc.body.appendChild(probe);
  const pxPer100mm = probe.offsetWidth || 1;
  probe.remove();
  return (px / pxPer100mm) * 100;
}

function applyMeasuredPageSize(
  frameDoc: Document,
  options: PrintHtmlDocumentOptions,
): void {
  const { measureSelector, paperWidthMm } = options;
  if (!measureSelector || !paperWidthMm) return;

  const el = frameDoc.querySelector(measureSelector);
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const heightMm = Math.ceil(pxToMm(rect.height, frameDoc) + 2);
  const widthMm = paperWidthMm;

  let pageStyle = frameDoc.getElementById("dynamic-page-size");
  if (!pageStyle) {
    pageStyle = frameDoc.createElement("style");
    pageStyle.id = "dynamic-page-size";
    frameDoc.head.appendChild(pageStyle);
  }
  pageStyle.textContent = `
    @page {
      size: ${widthMm}mm ${Math.max(heightMm, 40)}mm;
      margin: 0;
    }
    html, body {
      width: ${widthMm}mm;
      height: auto;
      min-height: 0;
    }
  `;
}

export function printHtmlDocument(
  html: string,
  options: PrintHtmlDocumentOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("Print is only available in the browser."));
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("title", "Print document");
    iframe.style.position = "fixed";
    iframe.style.left = "-10000px";
    iframe.style.top = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    // Real layout size — 0×0 iframes cause thermal receipts to clip / paginate wrong.
    if (options.layoutWidthMm) {
      iframe.style.width = `${options.layoutWidthMm}mm`;
      iframe.style.height = "2400px";
    } else {
      iframe.style.width = "0";
      iframe.style.height = "0";
    }

    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      iframe.remove();
      if (error) reject(error);
      else resolve();
    };

    iframe.onload = () => {
      void (async () => {
        try {
          const frameWindow = iframe.contentWindow;
          const frameDoc = iframe.contentDocument;
          if (!frameWindow || !frameDoc) {
            finish(new Error("Print frame unavailable."));
            return;
          }

          await waitForDocumentImages(frameDoc);
          if (frameDoc.fonts?.ready) {
            await Promise.race([
              frameDoc.fonts.ready,
              new Promise<void>((r) => window.setTimeout(r, 3_000)),
            ]);
          }

          // Allow layout to settle at the real iframe width, then size @page.
          await new Promise<void>((r) =>
            requestAnimationFrame(() => requestAnimationFrame(() => r())),
          );
          applyMeasuredPageSize(frameDoc, options);

          const onAfterPrint = () => {
            frameWindow.removeEventListener("afterprint", onAfterPrint);
            finish();
          };
          frameWindow.addEventListener("afterprint", onAfterPrint);

          window.setTimeout(() => {
            try {
              frameWindow.focus();
              frameWindow.print();
            } catch (error) {
              finish(
                error instanceof Error ? error : new Error("Print failed."),
              );
            }
          }, 50);

          window.setTimeout(() => finish(), 120_000);
        } catch (error) {
          finish(error instanceof Error ? error : new Error("Print failed."));
        }
      })();
    };

    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) {
      finish(new Error("Print frame unavailable."));
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
  });
}
