/** Reserved system product barcode (manual bill lines). Matches Android BillingConstants. */
export const MANUAL_BILL_PRODUCT_BARCODE = "__MANUAL_BILL__";

/** Android AddEditProductViewModel.generateBarcode(): P + 9 uppercase hex chars. */
export function generateProductBarcode(): string {
  const uuid = crypto.randomUUID().replace(/-/g, "").toUpperCase();
  return `P${uuid.slice(0, 9)}`;
}
