/**
 * Isolated iframe print helper (browser `window.print()`).
 * Used because Postrack web has no ESC/POS bridge like Android POS.
 */

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

export function printHtmlDocument(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("Print is only available in the browser."));
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("title", "Print document");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";

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
