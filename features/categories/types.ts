import type { CategoryRow } from "@/repositories/categories.repository";

export type CategoryListItem = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

export function mapCategoryRow(row: CategoryRow): CategoryListItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    productCount: row.product_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
