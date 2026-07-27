import type { AccountingCategoryRow } from "@/repositories/accounting-categories.repository";
import { isSystemAccountingCategory } from "@/utils/system-accounting-categories";

export type AccountingCategoryListItem = {
  id: string;
  name: string;
  type: "income" | "expense";
  description: string | null;
  isActive: boolean;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
  isSystem: boolean;
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
    isSystem: isSystemAccountingCategory(row.name, row.type),
  };
}
