import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database.types";
import { mapSupabaseError } from "@/utils/errors";
import { sanitizePostgrestSearch } from "@/utils/postgrest-filter";

export type StockInListRow =
  Database["public"]["Views"]["stock_in_list_view"]["Row"];

export type StockInHeaderRow = Database["public"]["Tables"]["stock_in"]["Row"];

export type StockInItemRow = Database["public"]["Tables"]["stock_in_items"]["Row"];

export type StockInItemDetail = StockInItemRow & {
  product_name: string;
  barcode: string | null;
  batch_name: string | null;
};

export type StockInListParams = {
  search?: string;
  page?: number;
  pageSize?: number;
};

export type StockInListResult = {
  items: StockInListRow[];
  total: number;
};

export type CreateStockInLineItem = {
  product_id: string;
  quantity: number;
  row_total: number;
  purchase_price?: number;
  selling_price?: number | null;
  mrp?: number | null;
  batch_name?: string | null;
  manufacturing_date?: string | null;
};

export async function listStockInEntries(
  supabase: SupabaseClient<Database>,
  params: StockInListParams = {},
): Promise<StockInListResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("stock_in_list_view")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (params.search?.trim()) {
    const term = sanitizePostgrestSearch(params.search);
    if (term) {
      query = query.or(
        `invoice_number.ilike.%${term}%,supplier_name.ilike.%${term}%,notes.ilike.%${term}%`,
      );
    }
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw mapSupabaseError(error);

  return {
    items: data ?? [],
    total: count ?? 0,
  };
}

export async function getStockInHeader(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<StockInHeaderRow | null> {
  const { data, error } = await supabase
    .from("stock_in")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw mapSupabaseError(error);
  return data;
}

export async function getStockInItems(
  supabase: SupabaseClient<Database>,
  stockInId: string,
): Promise<StockInItemDetail[]> {
  const { data: items, error } = await supabase
    .from("stock_in_items")
    .select("*")
    .eq("stock_in_id", stockInId)
    .order("created_at", { ascending: true });

  if (error) throw mapSupabaseError(error);
  if (!items?.length) return [];

  const productIds = [...new Set(items.map((item) => item.product_id))];
  const batchIds = [
    ...new Set(
      items
        .map((item) => item.batch_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [{ data: products, error: productError }, batchResult] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, barcode")
        .in("id", productIds),
      batchIds.length
        ? supabase
            .from("product_batches")
            .select("id, name, batch_seq")
            .in("id", batchIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (productError) throw mapSupabaseError(productError);
  if (batchResult.error) throw mapSupabaseError(batchResult.error);

  const productMap = new Map(
    (products ?? []).map((product) => [product.id, product]),
  );
  const batchMap = new Map(
    (batchResult.data ?? []).map((batch) => [batch.id, batch]),
  );

  return items.map((item) => {
    const product = productMap.get(item.product_id);
    const batch = item.batch_id ? batchMap.get(item.batch_id) : null;
    return {
      ...item,
      product_name: product?.name ?? "Unknown",
      barcode: product?.barcode ?? null,
      batch_name:
        batch?.name?.trim() ||
        (batch?.batch_seq != null ? `Batch ${batch.batch_seq}` : null),
    };
  });
}

export async function createStockIn(
  supabase: SupabaseClient<Database>,
  input: {
    date: string;
    items: CreateStockInLineItem[];
    supplierId?: string | null;
    invoiceNumber?: string | null;
    notes?: string | null;
    createdBy?: string | null;
    accountId?: string | null;
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("create_stock_in", {
    p_date: input.date,
    p_items: input.items as unknown as Json,
    p_supplier_id: input.supplierId ?? null,
    p_invoice_number: input.invoiceNumber?.trim() || null,
    p_notes: input.notes?.trim() || null,
    p_created_by: input.createdBy ?? null,
    p_account_id: input.accountId ?? null,
  });

  if (error) throw mapSupabaseError(error);
  const id = data?.[0]?.id;
  if (!id) {
    throw mapSupabaseError(
      error ?? { message: "Purchase creation failed", code: "UNKNOWN" },
    );
  }
  return id;
}
