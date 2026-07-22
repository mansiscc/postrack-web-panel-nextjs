import type { SupplierListRow } from "@/repositories/suppliers.repository";

export type SupplierListItem = {
  id: string;
  supplierName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstNumber: string | null;
  openingBalance: number | null;
  purchaseCount: number;
  isDeleted: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export function mapSupplierRow(row: SupplierListRow): SupplierListItem {
  return {
    id: row.id,
    supplierName: row.supplier_name,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    address: row.address,
    gstNumber: row.gst_number,
    openingBalance: row.opening_balance,
    purchaseCount: row.purchase_count,
    isDeleted: row.is_deleted ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
