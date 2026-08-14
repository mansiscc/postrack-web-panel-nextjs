import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type {
  ListResult,
  PaginationParams,
  SearchListParams,
} from "@/types/list-params";
import { buildCountMap } from "@/utils/count-by-key";
import { mapSupabaseError } from "@/utils/errors";
import {
  applyActiveStatusFilter,
  applyNameIlikeFilter,
  resolvePaginationRange,
} from "@/utils/repository-query";

export type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product_count: number;
};

type ListParams = SearchListParams & PaginationParams;

export async function listCategories(
  supabase: SupabaseClient<Database>,
  params: ListParams = {},
): Promise<ListResult<CategoryRow>> {
  const { paginate, from, to } = resolvePaginationRange(params);

  let query = supabase
    .from("product_categories")
    .select("id, name, description, is_active, created_at, updated_at", {
      count: "exact",
    })
    .order("name", { ascending: true });

  query = applyNameIlikeFilter(query, params.search);
  query = applyActiveStatusFilter(query, params.status);

  const {
    data: categories,
    error,
    count,
  } = paginate ? await query.range(from, to) : await query;
  if (error) throw mapSupabaseError(error);
  if (!categories?.length) return { items: [], total: count ?? 0 };

  const { data: productCounts, error: countError } = await supabase
    .from("products")
    .select("product_category_id")
    .eq("is_deleted", false)
    .in(
      "product_category_id",
      categories.map((category) => category.id),
    );

  if (countError) throw mapSupabaseError(countError);

  const countMap = buildCountMap(
    productCounts ?? [],
    (product) => product.product_category_id,
  );

  return {
    items: categories.map((category) => ({
      ...category,
      product_count: countMap.get(category.id) ?? 0,
    })),
    total: count ?? categories.length,
  };
}

export async function getCategoryById(
  supabase: SupabaseClient<Database>,
  id: string,
) {
  const { data, error } = await supabase
    .from("product_categories")
    .select("id, name, description, is_active, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw mapSupabaseError(error);
  return data;
}

export async function createCategory(
  supabase: SupabaseClient<Database>,
  input: {
    name: string;
    description?: string | null;
    isActive: boolean;
    companyId: string;
    userId: string;
  },
) {
  const { data, error } = await supabase
    .from("product_categories")
    .insert({
      company_id: input.companyId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      is_active: input.isActive,
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select("id")
    .single();

  if (error) throw mapSupabaseError(error);
  return data.id;
}

export async function updateCategory(
  supabase: SupabaseClient<Database>,
  id: string,
  input: {
    name: string;
    description?: string | null;
    isActive: boolean;
    userId: string;
  },
) {
  const { error } = await supabase
    .from("product_categories")
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      is_active: input.isActive,
      updated_by: input.userId,
    })
    .eq("id", id);

  if (error) throw mapSupabaseError(error);
}

export async function deleteCategory(
  supabase: SupabaseClient<Database>,
  id: string,
) {
  const { error } = await supabase
    .from("product_categories")
    .delete()
    .eq("id", id);

  if (error) throw mapSupabaseError(error);
}

export async function countCategoryProducts(
  supabase: SupabaseClient<Database>,
  categoryId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("product_category_id", categoryId)
    .eq("is_deleted", false);

  if (error) throw mapSupabaseError(error);
  return count ?? 0;
}
