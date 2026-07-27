import type { CustomerRow } from "@/repositories/customers.repository";

export type CustomerListItem = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function mapCustomerRow(row: CustomerRow): CustomerListItem {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
