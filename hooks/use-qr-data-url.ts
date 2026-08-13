"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

const qrCache = new Map<string, string>();

export function useQrDataUrl(value: string) {
  const [dataUrl, setDataUrl] = useState<string | null>(
    () => qrCache.get(value) ?? null,
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      setDataUrl(null);
      setError(true);
      return;
    }

    const cached = qrCache.get(trimmed);
    if (cached) {
      setDataUrl(cached);
      setError(false);
      return;
    }

    let cancelled = false;
    setError(false);
    setDataUrl(null);

    QRCode.toDataURL(trimmed, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 128,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        qrCache.set(trimmed, url);
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [value]);

  return { dataUrl, error };
}
