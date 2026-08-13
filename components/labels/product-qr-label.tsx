"use client";

import { useEffect, useState } from "react";

import type { QrStickerModel } from "@/utils/label-print";
import {
  labelSizeMm,
  QR_LABEL_PREVIEW_DPI,
  type QrLabelPreferences,
} from "@/utils/qr-label-preferences";
import {
  renderQrStickerBitmap,
  stickerCanvasToDataUrl,
} from "@/utils/qr-sticker-renderer";
import { cn } from "@/lib/utils";

type ProductQrLabelPreviewProps = {
  model: QrStickerModel;
  preferences: QrLabelPreferences;
  /** Display scale relative to physical mm (desktop preview). */
  previewScale?: number;
  className?: string;
};

/**
 * Single-label preview at {@link QR_LABEL_PREVIEW_DPI} (3× native).
 * CSS sizes the image to physical mm aspect; print path stays at 203 DPI.
 */
export function ProductQrLabelPreview({
  model,
  preferences,
  previewScale = 2,
  className,
}: ProductQrLabelPreviewProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const { widthMm, heightMm } = labelSizeMm(preferences.labelSize);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setDataUrl(null);

    renderQrStickerBitmap(model, preferences, QR_LABEL_PREVIEW_DPI, {
      flattenToBw: false,
    })
      .then((canvas) => {
        if (cancelled) return;
        setDataUrl(stickerCanvasToDataUrl(canvas));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- serialize prefs + model fields
  }, [
    model.productName,
    model.barcode,
    model.sellingPrice,
    model.mrp,
    preferences.labelSize,
    preferences.showTitle,
    preferences.titleSize,
    preferences.showPrice,
    preferences.priceSize,
    preferences.showCodeText,
  ]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-border bg-white shadow-card",
        className,
      )}
      style={{
        width: `${widthMm * previewScale}mm`,
        height: `${heightMm * previewScale}mm`,
      }}
    >
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt={`QR label ${model.productName}`}
          className="size-full object-fill"
          draggable={false}
        />
      ) : error ? (
        <div className="flex size-full items-center justify-center text-[11px] text-destructive">
          Preview failed
        </div>
      ) : (
        <div className="flex size-full items-center justify-center text-[11px] text-muted-foreground">
          …
        </div>
      )}
    </div>
  );
}
