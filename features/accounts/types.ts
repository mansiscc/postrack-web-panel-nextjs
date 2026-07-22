import type { AccountListRow } from "@/repositories/accounts.repository";

export type AccountListItem = {
  id: string;
  name: string;
  description: string | null;
  openingBalance: number;
  currentBalance: number;
  isDefault: boolean;
  isActive: boolean;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
};

export function mapAccountRow(row: AccountListRow): AccountListItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    openingBalance: row.opening_balance ?? 0,
    currentBalance: row.current_balance ?? 0,
    isDefault: row.is_default,
    isActive: row.is_active,
    entryCount: row.entry_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
