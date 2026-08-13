/**
 * Mirrors Android `QrLabelPreferences` / `QrLabelPreferenceStore`.
 * Stored separately from receipt print settings.
 */

export type QrLabelSize = "SMALL" | "LARGE";

export type QrLabelTextSize = "SMALL" | "MEDIUM" | "LARGE";

/** Mirrors Android `QrLabelCopiesMode`. */
export type QrLabelCopiesMode = "FIXED" | "USE_PURCHASE_QTY";

export type QrLabelPreferences = {
  labelSize: QrLabelSize;
  showTitle: boolean;
  titleSize: QrLabelTextSize;
  showPrice: boolean;
  priceSize: QrLabelTextSize;
  showCodeText: boolean;
  copiesMode: QrLabelCopiesMode;
  /** Used when copiesMode === FIXED. Android range 1–99. */
  fixedCopies: number;
};

export const QR_LABEL_PREFS_STORAGE_KEY = "postrack_qr_label_prefs";

export const QR_LABEL_MAX_FIXED_COPIES = 99;

/** Native TSC TE210 / Android thermal sticker DPI (print only). */
export const QR_LABEL_DEFAULT_DPI = 203;

/**
 * On-screen preview DPI (3× native). 25 mm → ~600 px.
 * Print must keep using {@link QR_LABEL_DEFAULT_DPI}.
 */
export const QR_LABEL_PREVIEW_DPI = QR_LABEL_DEFAULT_DPI * 3;

export const DEFAULT_QR_LABEL_PREFERENCES: QrLabelPreferences = {
  labelSize: "LARGE",
  showTitle: true,
  titleSize: "MEDIUM",
  showPrice: true,
  priceSize: "MEDIUM",
  showCodeText: true,
  copiesMode: "USE_PURCHASE_QTY",
  fixedCopies: 1,
};

export function labelSizeMm(size: QrLabelSize): { widthMm: number; heightMm: number } {
  // Dimensions live in `getQrLabelLayoutConfig` (single source of truth).
  // Inline here to avoid circular imports with layout consumers of preferences.
  return size === "SMALL"
    ? { widthMm: 25, heightMm: 25 }
    : { widthMm: 50, heightMm: 30 };
}

export function labelSizeDisplay(size: QrLabelSize): string {
  return size === "SMALL" ? "25 × 25 mm" : "50 × 30 mm";
}

export function mmToPx(mm: number, dpi = QR_LABEL_DEFAULT_DPI): number {
  return Math.max(1, Math.round((mm / 25.4) * dpi));
}

function parseLabelSize(value: unknown): QrLabelSize {
  if (value === "SMALL" || value === "25x25mm") return "SMALL";
  if (value === "LARGE" || value === "50x30mm" || value === "40x30mm" || value === "58x40mm") {
    return "LARGE";
  }
  return DEFAULT_QR_LABEL_PREFERENCES.labelSize;
}

function parseTextSize(value: unknown, fallback: QrLabelTextSize): QrLabelTextSize {
  if (value === "SMALL" || value === "S") return "SMALL";
  if (value === "MEDIUM" || value === "M") return "MEDIUM";
  if (value === "LARGE" || value === "L") return "LARGE";
  return fallback;
}

function parseCopiesMode(value: unknown): QrLabelCopiesMode {
  if (value === "USE_PURCHASE_QTY" || value === true) return "USE_PURCHASE_QTY";
  if (value === "FIXED" || value === false) return "FIXED";
  return DEFAULT_QR_LABEL_PREFERENCES.copiesMode;
}

export function readQrLabelPreferences(): QrLabelPreferences {
  if (typeof window === "undefined") return DEFAULT_QR_LABEL_PREFERENCES;
  try {
    const raw = localStorage.getItem(QR_LABEL_PREFS_STORAGE_KEY);
    if (!raw) {
      // One-time migrate from older combined print-settings keys if present.
      return migrateFromLegacyPrintSettings() ?? DEFAULT_QR_LABEL_PREFERENCES;
    }
    const parsed = JSON.parse(raw) as Partial<QrLabelPreferences>;
    const fixed = Number(parsed.fixedCopies);
    return {
      labelSize: parseLabelSize(parsed.labelSize),
      showTitle:
        typeof parsed.showTitle === "boolean"
          ? parsed.showTitle
          : DEFAULT_QR_LABEL_PREFERENCES.showTitle,
      titleSize: parseTextSize(
        parsed.titleSize,
        DEFAULT_QR_LABEL_PREFERENCES.titleSize,
      ),
      showPrice:
        typeof parsed.showPrice === "boolean"
          ? parsed.showPrice
          : DEFAULT_QR_LABEL_PREFERENCES.showPrice,
      priceSize: parseTextSize(
        parsed.priceSize,
        DEFAULT_QR_LABEL_PREFERENCES.priceSize,
      ),
      showCodeText:
        typeof parsed.showCodeText === "boolean"
          ? parsed.showCodeText
          : DEFAULT_QR_LABEL_PREFERENCES.showCodeText,
      copiesMode: parseCopiesMode(parsed.copiesMode),
      fixedCopies: Number.isFinite(fixed)
        ? Math.min(QR_LABEL_MAX_FIXED_COPIES, Math.max(1, Math.floor(fixed)))
        : DEFAULT_QR_LABEL_PREFERENCES.fixedCopies,
    };
  } catch {
    return DEFAULT_QR_LABEL_PREFERENCES;
  }
}

function migrateFromLegacyPrintSettings(): QrLabelPreferences | null {
  try {
    const raw = localStorage.getItem("postrack_print_settings");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.labelSize == null && parsed.usePurchaseQuantity == null) return null;
    const prefs: QrLabelPreferences = {
      ...DEFAULT_QR_LABEL_PREFERENCES,
      labelSize: parseLabelSize(parsed.labelSize),
      showTitle:
        typeof parsed.showTitleOnLabel === "boolean"
          ? parsed.showTitleOnLabel
          : DEFAULT_QR_LABEL_PREFERENCES.showTitle,
      titleSize: parseTextSize(
        parsed.titleSizeOnLabel,
        DEFAULT_QR_LABEL_PREFERENCES.titleSize,
      ),
      showPrice:
        typeof parsed.showPriceOnLabel === "boolean"
          ? parsed.showPriceOnLabel
          : DEFAULT_QR_LABEL_PREFERENCES.showPrice,
      priceSize: parseTextSize(
        parsed.priceSizeOnLabel,
        DEFAULT_QR_LABEL_PREFERENCES.priceSize,
      ),
      showCodeText:
        typeof parsed.showBarcodeTextOnLabel === "boolean"
          ? parsed.showBarcodeTextOnLabel
          : DEFAULT_QR_LABEL_PREFERENCES.showCodeText,
      copiesMode:
        parsed.usePurchaseQuantity === true ? "USE_PURCHASE_QTY" : "FIXED",
    };
    writeQrLabelPreferences(prefs);
    return prefs;
  } catch {
    return null;
  }
}

export function writeQrLabelPreferences(preferences: QrLabelPreferences) {
  localStorage.setItem(QR_LABEL_PREFS_STORAGE_KEY, JSON.stringify(preferences));
}
