/** Keep only digits, optionally capped at maxLength. */
export function digitsOnly(raw: string, maxLength?: number): string {
  const digits = raw.replace(/\D/g, "");
  return maxLength != null ? digits.slice(0, maxLength) : digits;
}

/** Integer string (no decimals). */
export function integerOnly(raw: string, maxLength?: number): string {
  const digits = raw.replace(/[^\d]/g, "");
  return maxLength != null ? digits.slice(0, maxLength) : digits;
}

/** Decimal string — digits and at most one dot. */
export function decimalOnly(raw: string): string {
  const filtered = raw.replace(/[^\d.]/g, "");
  const parts = filtered.split(".");
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : filtered;
}

/** Uppercase alphanumeric (invoice prefix, GSTIN). */
export function gstinOnly(raw: string, maxLength = 15): string {
  const value = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return value.slice(0, maxLength);
}

/** Trim barcode; keep scanner-friendly characters. */
export function barcodeOnly(raw: string, maxLength = 50): string {
  return raw.replace(/\s/g, "").slice(0, maxLength);
}

/** Uppercase alphanumeric (invoice prefix). */
export function alphanumericOnly(raw: string, maxLength?: number): string {
  const value = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return maxLength != null ? value.slice(0, maxLength) : value;
}
