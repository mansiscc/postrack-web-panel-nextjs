import type { BillHistoryRow } from "@/repositories/bills.repository";

export type SalesListItem = {
  id: string;
  billNumber: string | null;
  customerName: string;
  customerPhone: string;
  createdByName: string;
  createdAt: string;
  totalPayableAmount: number;
  paymentMode: BillHistoryRow["payment_mode"];
  status: BillHistoryRow["status"];
};

export function mapSalesRow(row: BillHistoryRow): SalesListItem {
  return {
    id: row.id,
    billNumber: row.bill_number,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    totalPayableAmount: row.total_payable_amount,
    paymentMode: row.payment_mode,
    status: row.status,
  };
}
