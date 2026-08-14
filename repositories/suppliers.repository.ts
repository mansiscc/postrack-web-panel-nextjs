import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { ListResult, PaginationParams } from "@/types/list-params";
import { buildCountMap } from "@/utils/count-by-key";
import { mapSupabaseError } from "@/utils/errors";
import {
  applyMultiFieldOrSearch,
  resolvePaginationRange,
} from "@/utils/repository-query";

export type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];

export type SupplierListRow = SupplierRow & {
  purchase_count: number;
};

type ListParams = PaginationParams & {
  search?: string;
  includeDeleted?: boolean;
};

export async function listSuppliers(
  supabase: SupabaseClient<Database>,
  params: ListParams = {},
): Promise<ListResult<SupplierListRow>> {
  const { paginate, from, to } = resolvePaginationRange(params);

  let query = supabase
    .from("suppliers")
    .select("*", { count: "exact" })
    .order("supplier_name", { ascending: true });

  if (!params.includeDeleted) {
    query = query.eq("is_deleted", false);
  }

  query = applyMultiFieldOrSearch(query, [
    "supplier_name",
    "phone",
    "contact_person",
  ], params.search);

  const { data, error, count } = paginate
    ? await query.range(from, to)
    : await query;
  if (error) throw mapSupabaseError(error);
  if (!data?.length) return { items: [], total: count ?? 0 };

  const { data: purchases, error: purchaseError } = await supabase
    .from("stock_in")
    .select("supplier_id")
    .in(
      "supplier_id",
      data.map((supplier) => supplier.id),
    );

  if (purchaseError) throw mapSupabaseError(purchaseError);

  const countMap = buildCountMap(purchases ?? [], (row) => row.supplier_id);

  return {
    items: data.map((supplier) => ({
      ...supplier,
      purchase_count: countMap.get(supplier.id) ?? 0,
    })),
    total: count ?? data.length,
  };
}

export async function getSupplierById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<SupplierRow | null> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw mapSupabaseError(error);
  return data;
}

export async function createSupplier(
  supabase: SupabaseClient<Database>,
  input: {
    supplierName: string;
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    gstNumber?: string | null;
    openingBalance?: number | null;
    companyId: string;
  },
) {
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      company_id: input.companyId,
      supplier_name: input.supplierName.trim(),
      contact_person: input.contactPerson?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      gst_number: input.gstNumber?.trim() || null,
      opening_balance: input.openingBalance ?? 0,
      is_deleted: false,
    })
    .select("id")
    .single();

  if (error) throw mapSupabaseError(error);
  return data.id;
}

export async function updateSupplier(
  supabase: SupabaseClient<Database>,
  id: string,
  input: {
    supplierName: string;
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    gstNumber?: string | null;
    openingBalance?: number | null;
  },
) {
  const { error } = await supabase
    .from("suppliers")
    .update({
      supplier_name: input.supplierName.trim(),
      contact_person: input.contactPerson?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      gst_number: input.gstNumber?.trim() || null,
      opening_balance: input.openingBalance ?? 0,
    })
    .eq("id", id);

  if (error) throw mapSupabaseError(error);
}

export async function softDeleteSupplier(
  supabase: SupabaseClient<Database>,
  id: string,
) {
  const { error } = await supabase
    .from("suppliers")
    .update({ is_deleted: true })
    .eq("id", id);

  if (error) throw mapSupabaseError(error);
}

export async function restoreSupplier(
  supabase: SupabaseClient<Database>,
  id: string,
) {
  const { error } = await supabase
    .from("suppliers")
    .update({ is_deleted: false })
    .eq("id", id);

  if (error) throw mapSupabaseError(error);
}

export async function listSupplierPurchases(
  supabase: SupabaseClient<Database>,
  supplierId: string,
) {
  const { data, error } = await supabase
    .from("stock_in")
    .select(
      "id, date, invoice_number, notes, total_items, total_amount, created_at, created_by",
    )
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });

  if (error) throw mapSupabaseError(error);
  if (!data?.length) return [];

  const userIds = [
    ...new Set(
      data
        .map((row) => row.created_by)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const userMap = new Map<string, string>();
  if (userIds.length) {
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, full_name")
      .in("id", userIds);

    if (userError) throw mapSupabaseError(userError);
    for (const user of users ?? []) {
      userMap.set(user.id, user.full_name);
    }
  }

  return data.map((purchase) => ({
    ...purchase,
    created_by_name: purchase.created_by
      ? userMap.get(purchase.created_by) ?? null
      : null,
  }));
}
