"use client";

import { MessageCircle, Printer } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { printReceiptDocument } from "@/utils/print-receipt-document";
import {
  readPrintSettings,
  type ReceiptPaperWidth,
} from "@/utils/print-settings";
import { type ReceiptPreviewData } from "@/utils/receipt-preview-data";
import {
  RECEIPT_MONO_FONT,
  buildReceiptLines,
  ensureReceiptMonoFontLoaded,
  getReceiptPreviewShellStyle,
  getReceiptRenderMeta,
  toReceiptNbspLine,
} from "@/utils/receipt-render";
import { receiptLineStyle } from "@/utils/receipt-text-formatter";
import { shareBillOnWhatsApp } from "@/utils/share-bill-whatsapp";

export type { ReceiptPreviewData };

export function ReceiptPreview({
  data,
  active = true,
}: {
  data: ReceiptPreviewData;
  /** When false (dialog closed), skip work; when true, re-read paper size. */
  active?: boolean;
}) {
  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidth>("80mm");
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    if (!active) return;
    // Re-read local setting each time preview is shown (size can change in Business Profile).
    setPaperWidth(readPrintSettings().paperWidth);
    ensureReceiptMonoFontLoaded();
    let cancelled = false;
    const ready = async () => {
      try {
        if (document.fonts?.load) {
          await Promise.all([
            document.fonts.load(`400 ${11}px "Roboto Mono"`),
            document.fonts.load(`700 ${11}px "Roboto Mono"`),
          ]);
        }
        if (document.fonts?.ready) await document.fonts.ready;
      } catch {
        // Fallback fonts still render.
      }
      if (!cancelled) setFontReady(true);
    };
    void ready();
    return () => {
      cancelled = true;
    };
  }, [active]);

  const { layout, outer } = getReceiptPreviewShellStyle(paperWidth);
  const { showLogo, logoSrc, businessName } = getReceiptRenderMeta(data);
  const lines = useMemo(
    () => buildReceiptLines(data, paperWidth),
    [data, paperWidth],
  );
  const chars = layout.charactersPerLine;

  return (
    <div className="mx-auto bg-white text-black" style={outer}>
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element -- receipt print/preview needs a plain img URL
        <img
          src={logoSrc}
          alt={businessName}
          className="mx-auto mb-2 max-h-16 w-auto max-w-[70%] object-contain"
        />
      ) : null}

      <div
        style={{
          fontFamily: RECEIPT_MONO_FONT,
          fontSize: `${layout.bodyFontPx}px`,
          lineHeight: 1.25,
          width: `${chars}ch`,
          maxWidth: "100%",
          color: "#000",
          fontVariantLigatures: "none",
          fontKerning: "none",
          fontSynthesis: "none",
          fontFeatureSettings: '"tnum"',
          opacity: fontReady ? 1 : 0.99,
        }}
      >
        {lines.map((line, index) => {
          const style = receiptLineStyle(line, businessName);

          // Company name: CSS-center (Android PDF measures text; space-padding
          // breaks when title uses a larger font size).
          if (style === "title") {
            return (
              <div
                key={index}
                style={{
                  textAlign: "center",
                  fontWeight: 700,
                  fontSize: `${layout.titleFontPx}px`,
                  width: "100%",
                  whiteSpace: "normal",
                }}
              >
                {businessName}
              </div>
            );
          }

          return (
            <div
              key={index}
              style={{
                // Same size for every column line — required for alignment.
                fontSize: `${layout.bodyFontPx}px`,
                fontWeight: style === "emph" ? 700 : 400,
                whiteSpace: "pre",
                width: `${chars}ch`,
                maxWidth: "100%",
                overflow: "hidden",
              }}
            >
              {toReceiptNbspLine(line, chars)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ReceiptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReceiptPreviewData | null;
  /**
   * Android: Paid Amount on billing "Save & WhatsApp";
   * omit on bill-detail "Share on WhatsApp".
   */
  includePaidAmountInWhatsApp?: boolean;
};

export function ReceiptDialog({
  open,
  onOpenChange,
  data,
  includePaidAmountInWhatsApp = true,
}: ReceiptDialogProps) {
  const [isPrinting, startPrint] = useTransition();
  const [isSharing, startShare] = useTransition();

  const handlePrint = () => {
    if (!data) return;
    startPrint(async () => {
      try {
        await printReceiptDocument(data);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to print receipt",
        );
      }
    });
  };

  const handleWhatsApp = () => {
    if (!data) return;
    startShare(async () => {
      try {
        await shareBillOnWhatsApp(data, {
          includePaidAmount: includePaidAmountInWhatsApp,
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to share on WhatsApp",
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/60 px-5 py-4 pr-12">
          <DialogTitle>
            {data?.billNumber ? `Bill ${data.billNumber}` : "Receipt"}
          </DialogTitle>
        </DialogHeader>

        {data ? (
          <div className="overflow-x-auto px-5 py-4">
            <ReceiptPreview data={data} active={open} />
          </div>
        ) : null}

        <DialogFooter className="mx-0 mb-0 rounded-b-lg sm:justify-stretch">
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              disabled={!data || isPrinting || isSharing}
              onClick={handlePrint}
            >
              <Printer />
              {isPrinting ? "Printing…" : "Print / Save PDF"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!data || isSharing}
              onClick={handleWhatsApp}
            >
              <MessageCircle />
              {isSharing ? "Sharing…" : "WhatsApp"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
