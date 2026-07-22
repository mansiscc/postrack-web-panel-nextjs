import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database.types";
import { mapSupabaseError } from "@/utils/errors";
import { sanitizePostgrestSearch } from "@/utils/postgrest-filter";

export type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export type ProductListRow = ProductRow & {
  category_name: string | null;
};

export type ProductListParams = {
  search?: string;
  categoryId?: string | "all";
  stock?: "all" | "in_stock" | "low_stock" | "out_of_stock";
  status?: "all" | "active" | "inactive" | "deleted";
};

export type ProductBatchRow = {
  id: string;
  batch_seq: number;
  name: string;
  purchase_price: number;
  selling_price: number | null;
  mrp: number | null;
  quantity_remaining: number;
};

export type CreateProductRpcInput = {
  name: string;
  barcode?: string | null;
  purchasePrice?: number | null;
  sellingPrice?: number | null;
  mrp?: number | null;
  unit?: string | null;
  lowStockAlertQty?: number;
  productCategoryId?: string | null;
  openingStock?: number;
  isActive?: boolean;
  createdBy?: string | null;
  imageUrl?: string | null;
};

export type UpdateProductInput = {
  name: string;
  barcode?: string | null;
  purchasePrice?: number | null;
  sellingPrice?: number | null;
  mrp?: number | null;
  unit?: string | null;
  lowStockAlertQty?: number;
  productCategoryId?: string | null;
  stockQuantity?: number;
  isActive?: boolean;
  imageUrl?: string | null;
};

export async function listProducts(
  supabase: SupabaseClient<Database>,
  params: ProductListParams = {},
): Promise<ProductListRow[]> {
  let query = supabase
    .from("products")
    .select(
      `
      *,
      product_categories ( name )
    `,
    )
    .order("name", { ascending: true });

  if (params.status === "deleted") {
    query = query.eq("is_deleted", true);
  } else if (params.status === "active") {
    query = query.eq("is_deleted", false).eq("is_active", true);
  } else if (params.status === "inactive") {
    query = query.eq("is_deleted", false).eq("is_active", false);
  } else if (params.status && params.status !== "all") {
    query = query.eq("is_deleted", false);
  }

  if (params.categoryId && params.categoryId !== "all") {
    query = query.eq("product_category_id", params.categoryId);
  }

  if (params.search?.trim()) {
    const term = sanitizePostgrestSearch(params.search);
    if (term) {
      query = query.or(`name.ilike.%${term}%,barcode.ilike.%${term}%`);
    }
  }

  const { data, error } = await query;
  if (error) throw mapSupabaseError(error);

  let rows = (data ?? []).map((row) => {
    const { product_categories, ...product } = row;
    const category = product_categories as { name: string } | null;
    return {
      ...product,
      category_name: category?.name ?? null,
    };
  });

  if (params.stock && params.stock !== "all") {
    rows = rows.filter((row) => {
      const stock = row.stock_quantity ?? 0;
      const alert = row.low_stock_alert_qty ?? 0;
      if (params.stock === "out_of_stock") return stock <= 0;
      if (params.stock === "low_stock") return stock > 0 && stock <= alert;
      if (params.stock === "in_stock") return stock > alert;
      return true;
    });
  }

  return rows;
}

export async function getProductById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<ProductListRow | null> {
  const { data, error } = await supabase
    .from("products")
    .select(
      `
      *,
      product_categories ( name )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw mapSupabaseError(error);
  if (!data) return null;

  const { product_categories, ...product } = data;
  const category = product_categories as { name: string } | null;
  return {
    ...product,
    category_name: category?.name ?? null,
  };
}

export async function getProductByBarcode(
  supabase: SupabaseClient<Database>,
  barcode: string,
  excludeId?: string,
): Promise<ProductRow | null> {
  let query = supabase
    .from("products")
    .select("*")
    .eq("barcode", barcode.trim());

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw mapSupabaseError(error);
  return data;
}

export async function createProductWithOpeningStock(
  supabase: SupabaseClient<Database>,
  input: CreateProductRpcInput,
): Promise<string> {
  const { data, error } = await supabase.rpc("create_product_with_opening_stock", {
    p_name: input.name.trim(),
    p_barcode: input.barcode?.trim() || null,
    p_purchase_price: input.purchasePrice ?? null,
    p_selling_price: input.sellingPrice ?? null,
    p_mrp: input.mrp ?? null,
    p_unit: input.unit?.trim() || null,
    p_low_stock_alert_qty: input.lowStockAlertQty ?? 0,
    p_product_category_id: input.productCategoryId ?? null,
    p_opening_stock: input.openingStock ?? 0,
    p_is_active: input.isActive ?? true,
    p_created_by: input.createdBy ?? null,
    p_image_url: input.imageUrl ?? null,
  });

  if (error) throw mapSupabaseError(error);
  const id = data?.[0]?.id;
  if (!id) {
    throw mapSupabaseError(
      error ?? { message: "Product creation failed", code: "UNKNOWN" },
    );
  }
  return id;
}

export async function updateProduct(
  supabase: SupabaseClient<Database>,
  id: string,
  input: UpdateProductInput,
) {
  const { error } = await supabase
    .from("products")
    .update({
      name: input.name.trim(),
      barcode: input.barcode?.trim() || null,
      purchase_price: input.purchasePrice ?? null,
      selling_price: input.sellingPrice ?? null,
      mrp: input.mrp ?? null,
      unit: input.unit?.trim() || null,
      low_stock_alert_qty: input.lowStockAlertQty ?? 0,
      product_category_id: input.productCategoryId ?? null,
      stock_quantity: input.stockQuantity,
      is_active: input.isActive ?? true,
      image_url: input.imageUrl ?? null,
    })
    .eq("id", id);

  if (error) throw mapSupabaseError(error);
}

export async function softDeleteProduct(
  supabase: SupabaseClient<Database>,
  id: string,
) {
  const { error } = await supabase
    .from("products")
    .update({ is_deleted: true })
    .eq("id", id);

  if (error) throw mapSupabaseError(error);
}

export async function restoreProduct(
  supabase: SupabaseClient<Database>,
  id: string,
) {
  const { error } = await supabase
    .from("products")
    .update({ is_deleted: false })
    .eq("id", id);

  if (error) throw mapSupabaseError(error);
}

export async function getProductDetails(
  supabase: SupabaseClient<Database>,
  productId: string,
): Promise<Json | null> {
  const { data, error } = await supabase.rpc("get_product_details", {
    p_product_id: productId,
  });

  if (error) throw mapSupabaseError(error);
  return data;
}

export async function getProductBatchesWithStock(
  supabase: SupabaseClient<Database>,
  productId: string,
): Promise<ProductBatchRow[]> {
  const { data, error } = await supabase.rpc("get_product_batches_with_stock", {
    p_product_id: productId,
  });

  if (error) throw mapSupabaseError(error);
  return data ?? [];
}
