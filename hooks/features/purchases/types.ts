import type { StockInListRow } from "@/repositories/stock-in.repository";

export type PurchaseListItem = {
  id: string;
  date: string;
  invoiceNumber: string | null;
  notes: string | null;
  totalItems: number;
  totalAmount: number;
  supplierName: string;
  createdByName: string | null;
  createdAt: string;
};

export function mapPurchaseRow(row: StockInListRow): PurchaseListItem {
  return {
    id: row.id,
    date: row.date,
    invoiceNumber: row.invoice_number,
    notes: row.notes,
    totalItems: row.total_items,
    totalAmount: row.total_amount,
    supplierName: row.supplier_name,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  };
}

export function isOpeningPurchase(item: PurchaseListItem): boolean {
  return item.invoiceNumber === "OPENING" || item.supplierName === "Opening Stock";
}
