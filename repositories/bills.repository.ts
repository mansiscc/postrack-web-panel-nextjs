import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { AppError, mapSupabaseError } from "@/utils/errors";
import { sanitizePostgrestSearch } from "@/utils/postgrest-filter";

export type BillHistoryRow =
  Database["public"]["Views"]["bill_history_sales_view"]["Row"];

export type BillRow = Database["public"]["Tables"]["bills"]["Row"];
export type BillItemRow = Database["public"]["Tables"]["bill_items"]["Row"];

export type BillListParams = {
  search?: string;
  status?: BillHistoryRow["status"] | "all";
  paymentMode?: BillHistoryRow["payment_mode"] | "all";
  page?: number;
  pageSize?: number;
};

export type BillListResult = {
  items: BillHistoryRow[];
  total: number;
};

export async function listBillHistory(
  supabase: SupabaseClient<Database>,
  params: BillListParams = {},
): Promise<BillListResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("bill_history_sales_view")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (params.search?.trim()) {
    const term = sanitizePostgrestSearch(params.search);
    if (term) {
      query = query.or(
        `bill_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`,
      );
    }
  }

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  if (params.paymentMode && params.paymentMode !== "all") {
    query = query.eq("payment_mode", params.paymentMode);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw mapSupabaseError(error);

  return { items: data ?? [], total: count ?? 0 };
}

export async function getBillById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<BillRow | null> {
  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw mapSupabaseError(error);
  return data;
}

export async function getBillItems(
  supabase: SupabaseClient<Database>,
  billId: string,
): Promise<BillItemRow[]> {
  const { data, error } = await supabase
    .from("bill_items")
    .select("*")
    .eq("bill_id", billId)
    .order("product_name", { ascending: true });

  if (error) throw mapSupabaseError(error);
  return data ?? [];
}

export async function getReturnedQuantitiesByBillItem(
  supabase: SupabaseClient<Database>,
  billId: string,
): Promise<Map<string, number>> {
  const { data: returns, error: returnError } = await supabase
    .from("bill_returns")
    .select("id")
    .eq("bill_id", billId);

  if (returnError) throw mapSupabaseError(returnError);
  if (!returns?.length) return new Map();

  const returnIds = returns.map((row) => row.id);
  const { data: items, error } = await supabase
    .from("bill_return_items")
    .select("bill_item_id, quantity")
    .in("return_id", returnIds);

  if (error) throw mapSupabaseError(error);

  const map = new Map<string, number>();
  for (const item of items ?? []) {
    const current = map.get(item.bill_item_id) ?? 0;
    map.set(item.bill_item_id, current + item.quantity);
  }
  return map;
}

export async function createBill(
  supabase: SupabaseClient<Database>,
  input: Database["public"]["Tables"]["bills"]["Insert"],
) {
  const { data, error } = await supabase
    .from("bills")
    .insert(input)
    .select("id, bill_number")
    .single();

  if (error) throw mapSupabaseError(error);
  return data;
}

export async function createBillItems(
  supabase: SupabaseClient<Database>,
  items: Database["public"]["Tables"]["bill_items"]["Insert"][],
) {
  const { error } = await supabase.from("bill_items").insert(items);
  if (error) throw mapSupabaseError(error);
}

export async function createBillEntry(
  supabase: SupabaseClient<Database>,
  input: Database["public"]["Tables"]["entries"]["Insert"],
) {
  const { error } = await supabase.from("entries").insert(input);
  if (error) throw mapSupabaseError(error);
}

export async function getSalesCategoryId(
  supabase: SupabaseClient<Database>,
  companyId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("accounting_categories")
    .select("id")
    .eq("company_id", companyId)
    .eq("name", "Sales")
    .eq("type", "income")
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw mapSupabaseError(error);
  return data?.id ?? null;
}

export async function getManualBillProductId(
  supabase: SupabaseClient<Database>,
): Promise<string> {
  const { data, error } = await supabase.rpc("get_manual_bill_product_id");
  if (error) throw mapSupabaseError(error);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.id) {
    throw new AppError(
      "Manual bill product placeholder is not configured",
      "NOT_FOUND",
      404,
    );
  }
  return row.id;
}

export async function searchBillingProducts(
  supabase: SupabaseClient<Database>,
  query?: string,
) {
  let dbQuery = supabase
    .from("products")
    .select(
      "id, name, barcode, selling_price, mrp, stock_quantity, image_url, is_active, is_deleted",
    )
    .eq("is_deleted", false)
    .eq("is_active", true)
    .gt("stock_quantity", 0)
    .order("name", { ascending: true })
    .limit(50);

  if (query?.trim()) {
    const term = sanitizePostgrestSearch(query);
    if (term) {
      dbQuery = dbQuery.or(`name.ilike.%${term}%,barcode.ilike.%${term}%`);
    }
  }

  const { data, error } = await dbQuery;
  if (error) throw mapSupabaseError(error);
  return data ?? [];
}

export async function createBillReturn(
  supabase: SupabaseClient<Database>,
  input: Database["public"]["Tables"]["bill_returns"]["Insert"],
) {
  const { data, error } = await supabase
    .from("bill_returns")
    .insert(input)
    .select("id, return_number")
    .single();

  if (error) throw mapSupabaseError(error);
  return data;
}

export async function createBillReturnItems(
  supabase: SupabaseClient<Database>,
  items: Database["public"]["Tables"]["bill_return_items"]["Insert"][],
) {
  const { error } = await supabase.from("bill_return_items").insert(items);
  if (error) throw mapSupabaseError(error);
}

export async function updateBillStatus(
  supabase: SupabaseClient<Database>,
  billId: string,
  input: {
    status: BillRow["status"];
    returnNote?: string | null;
    returnedAt?: string | null;
  },
) {
  const { error } = await supabase
    .from("bills")
    .update({
      status: input.status,
      return_note: input.returnNote ?? null,
      returned_at: input.returnedAt ?? null,
    })
    .eq("id", billId);

  if (error) throw mapSupabaseError(error);
}
