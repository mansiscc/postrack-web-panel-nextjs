"use client";

import { useEffect, useState } from "react";

import type { QrStickerModel } from "@/utils/label-print";
import { copiesFor } from "@/utils/label-print";
import {
  chunkIntoRows,
  getQrLabelLayoutConfig,
  padLabelsToColumns,
} from "@/utils/qr-label-layout";
import {
  QR_LABEL_PREVIEW_DPI,
  type QrLabelPreferences,
} from "@/utils/qr-label-preferences";
import {
  renderQrStickerBitmap,
  stickerCanvasToDataUrl,
} from "@/utils/qr-sticker-renderer";
import { cn } from "@/lib/utils";

type QrLabelSheetPreviewProps = {
  models: QrStickerModel[];
  preferences: QrLabelPreferences;
  /** Scale for on-screen preview (mm × scale). */
  previewScale?: number;
  className?: string;
};

/**
 * Multi-column sheet preview matching physical print layout.
 * Renders stickers at {@link QR_LABEL_PREVIEW_DPI} (3×) for a sharp screen
 * preview, displayed at physical mm aspect — print stays at 203 DPI.
 */
export function QrLabelSheetPreview({
  models,
  preferences,
  previewScale = 1.2,
  className,
}: QrLabelSheetPreviewProps) {
  const layout = getQrLabelLayoutConfig(preferences.labelSize);
  const [cellUrls, setCellUrls] = useState<Array<string | null>>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setCellUrls([]);

    (async () => {
      try {
        const printable = models.filter((m) => m.barcode.trim());
        const urls: string[] = [];
        for (const model of printable) {
          const copies = copiesFor(model.quantity, preferences);
          const canvas = await renderQrStickerBitmap(
            model,
            preferences,
            QR_LABEL_PREVIEW_DPI,
            { flattenToBw: false },
          );
          const url = stickerCanvasToDataUrl(canvas);
          for (let i = 0; i < copies; i += 1) {
            urls.push(url);
          }
        }
        if (cancelled) return;
        setCellUrls(padLabelsToColumns(urls, layout.columns));
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [models, preferences, layout.columns]);

  const rows = chunkIntoRows(cellUrls, layout.columns);
  const cellW = layout.labelWidth * previewScale;
  const cellH = layout.labelHeight * previewScale;

  if (error) {
    return (
      <p className="text-center text-sm text-destructive">Preview failed</p>
    );
  }

  if (cellUrls.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Generating preview…
      </p>
    );
  }

  return (
    <div
      className={cn("inline-flex flex-col gap-0 overflow-auto", className)}
      style={{
        width: `${layout.pageWidthMm * previewScale}mm`,
        maxWidth: "100%",
      }}
    >
      {rows.map((row, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className="flex flex-row flex-nowrap"
          style={{
            width: `${layout.pageWidthMm * previewScale}mm`,
            height: `${layout.pageHeightMm * previewScale}mm`,
          }}
        >
          {row.map((url, colIndex) => (
            <div
              key={`cell-${rowIndex}-${colIndex}`}
              className={cn(
                "box-border shrink-0 border border-dashed border-border/70 bg-white",
                !url && "bg-muted/30",
              )}
              style={{ width: `${cellW}mm`, height: `${cellH}mm` }}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt=""
                  // Smooth CSS downscale of the hi-res bitmap (do not use pixelated).
                  className="block size-full object-fill"
                  draggable={false}
                />
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
