export type ReceiptPaperWidth = "58mm" | "76mm" | "80mm";

export type PrintSettings = {
  paperWidth: ReceiptPaperWidth;
  openReceiptAfterSave: boolean;
  /** After saving a stock-in, prompt to open the QR label print page. */
  openLabelsAfterStockIn: boolean;
};

export const PRINT_SETTINGS_STORAGE_KEY = "postrack_print_settings";

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paperWidth: "80mm",
  openReceiptAfterSave: true,
  openLabelsAfterStockIn: true,
};

function isReceiptPaperWidth(value: unknown): value is ReceiptPaperWidth {
  return value === "58mm" || value === "76mm" || value === "80mm";
}

export function readPrintSettings(): PrintSettings {
  if (typeof window === "undefined") return DEFAULT_PRINT_SETTINGS;
  try {
    const raw = localStorage.getItem(PRINT_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_PRINT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PrintSettings>;
    return {
      paperWidth: isReceiptPaperWidth(parsed.paperWidth)
        ? parsed.paperWidth
        : DEFAULT_PRINT_SETTINGS.paperWidth,
      openReceiptAfterSave:
        typeof parsed.openReceiptAfterSave === "boolean"
          ? parsed.openReceiptAfterSave
          : DEFAULT_PRINT_SETTINGS.openReceiptAfterSave,
      openLabelsAfterStockIn:
        typeof parsed.openLabelsAfterStockIn === "boolean"
          ? parsed.openLabelsAfterStockIn
          : DEFAULT_PRINT_SETTINGS.openLabelsAfterStockIn,
    };
  } catch {
    return DEFAULT_PRINT_SETTINGS;
  }
}

export function writePrintSettings(settings: PrintSettings) {
  localStorage.setItem(PRINT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

/** CSS max-width for on-screen receipt preview (roll / media width). */
export function paperWidthToMaxCss(width: ReceiptPaperWidth): string {
  if (width === "58mm") return "58mm";
  if (width === "76mm") return "76mm";
  return "80mm";
}
