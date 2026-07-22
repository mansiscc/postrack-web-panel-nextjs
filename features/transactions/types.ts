import type { TransactionListRow } from "@/repositories/transactions.repository";

export type TransactionListItem = {
  id: string;
  entryDate: string;
  entryType: "income" | "expense";
  accountId: string;
  accountName: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  remarks: string | null;
  sourceType:
    | "bill"
    | "bill_return"
    | "purchase"
    | "manual"
    | "bill_payment"
    | null;
  paymentMode: "Cash" | "UPI" | "Card" | "Mixed" | null;
  createdAt: string;
  isManual: boolean;
};

export function mapTransactionRow(row: TransactionListRow): TransactionListItem {
  return {
    id: row.id,
    entryDate: row.entry_date,
    entryType: row.entry_type,
    accountId: row.account_id,
    accountName: row.account_name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    amount: row.amount,
    remarks: row.remarks,
    sourceType: row.source_type,
    paymentMode: row.payment_mode,
    createdAt: row.created_at,
    isManual: row.source_type === "manual",
  };
}

export function getSourceTypeLabel(
  sourceType: TransactionListItem["sourceType"],
): string {
  switch (sourceType) {
    case "manual":
      return "Manual";
    case "bill":
      return "Sale";
    case "bill_return":
      return "Sales return";
    case "purchase":
      return "Purchase";
    case "bill_payment":
      return "Bill payment";
    default:
      return "System";
  }
}
