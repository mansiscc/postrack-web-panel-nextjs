import { headers } from "next/headers";

import { logActivity } from "@/lib/activity-log";
import {
  createSupplier,
  getSupplierById,
  listSupplierPurchases,
  listSuppliers,
  restoreSupplier,
  softDeleteSupplier,
  updateSupplier,
} from "@/repositories/suppliers.repository";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/types/auth";
import { AppError } from "@/utils/errors";

type SupplierInput = {
  supplierName: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstNumber?: string | null;
  openingBalance?: number | null;
};

export async function getSuppliersList(params?: {
  search?: string;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const supabase = await createClient();
  return listSuppliers(supabase, params);
}

export async function getSupplierDetail(supplierId: string) {
  const supabase = await createClient();
  const [supplier, purchases] = await Promise.all([
    getSupplierById(supabase, supplierId),
    listSupplierPurchases(supabase, supplierId),
  ]);

  const purchaseSummary =
    purchases.length === 0
      ? null
      : {
          totalEntries: purchases.length,
          totalItems: purchases.reduce(
            (sum, purchase) => sum + (purchase.total_items ?? 0),
            0,
          ),
          totalAmount: purchases.reduce(
            (sum, purchase) => sum + Number(purchase.total_amount ?? 0),
            0,
          ),
          lastPurchaseDate: purchases.reduce<string | null>((latest, purchase) => {
            if (!purchase.date) return latest;
            if (!latest || purchase.date > latest) return purchase.date;
            return latest;
          }, null),
        };

  return { supplier, purchases, purchaseSummary };
}

export async function createSupplierRecord(
  user: SessionUser,
  input: SupplierInput,
) {
  const supabase = await createClient();
  const id = await createSupplier(supabase, {
    ...input,
    companyId: user.companyId,
  });

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Create",
    moduleName: "Suppliers",
    description: `Created supplier "${input.supplierName}"`,
    status: "Success",
    recordId: id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  return id;
}

export async function updateSupplierRecord(
  user: SessionUser,
  supplierId: string,
  input: SupplierInput,
) {
  const supabase = await createClient();
  const existing = await getSupplierById(supabase, supplierId);
  if (!existing) throw new AppError("Supplier not found", "NOT_FOUND", 404);
  if (existing.is_deleted) {
    throw new AppError("Restore the supplier before editing", "SUPPLIER_DELETED");
  }

  await updateSupplier(supabase, supplierId, input);

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Update",
    moduleName: "Suppliers",
    description: `Updated supplier "${input.supplierName}"`,
    status: "Success",
    recordId: supplierId,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}

export async function removeSupplier(user: SessionUser, supplierId: string) {
  const supabase = await createClient();
  const existing = await getSupplierById(supabase, supplierId);
  if (!existing) throw new AppError("Supplier not found", "NOT_FOUND", 404);

  await softDeleteSupplier(supabase, supplierId);

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Delete",
    moduleName: "Suppliers",
    description: `Deleted supplier "${existing.supplier_name}"`,
    status: "Success",
    recordId: supplierId,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}

export async function restoreSupplierRecord(
  user: SessionUser,
  supplierId: string,
) {
  const supabase = await createClient();
  const existing = await getSupplierById(supabase, supplierId);
  if (!existing) throw new AppError("Supplier not found", "NOT_FOUND", 404);

  await restoreSupplier(supabase, supplierId);

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Update",
    moduleName: "Suppliers",
    description: `Restored supplier "${existing.supplier_name}"`,
    status: "Success",
    recordId: supplierId,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}
