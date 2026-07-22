const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "₹0.00";
  return currencyFormatter.format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "0";
  return numberFormatter.format(value);
}

/** Parse user input like "1,234.50" or "₹1,234.50" into a number. */
export function parseCurrency(input: string): number {
  const cleaned = input.replace(/[₹,\s]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}
