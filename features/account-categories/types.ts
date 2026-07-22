import type { AccountingCategoryRow } from "@/repositories/accounting-categories.repository";

export type AccountingCategoryListItem = {
  id: string;
  name: string;
  type: "income" | "expense";
  description: string | null;
  isActive: boolean;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
};

export function mapAccountingCategoryRow(
  row: AccountingCategoryRow,
): AccountingCategoryListItem {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description,
    isActive: row.is_active,
    entryCount: row.entry_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
