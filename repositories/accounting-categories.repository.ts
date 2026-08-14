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

export type AccountingCategoryRow = {
  id: string;
  name: string;
  type: "income" | "expense";
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  entry_count: number;
};

type ListParams = SearchListParams &
  PaginationParams & {
    type?: "all" | "income" | "expense";
  };

export async function listAccountingCategories(
  supabase: SupabaseClient<Database>,
  params: ListParams = {},
): Promise<ListResult<AccountingCategoryRow>> {
  const { paginate, from, to } = resolvePaginationRange(params);

  let query = supabase
    .from("accounting_categories")
    .select(
      "id, name, type, description, is_active, created_at, updated_at",
      { count: "exact" },
    )
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  query = applyNameIlikeFilter(query, params.search);

  if (params.type === "income" || params.type === "expense") {
    query = query.eq("type", params.type);
  }

  query = applyActiveStatusFilter(query, params.status);

  const {
    data: categories,
    error,
    count,
  } = paginate ? await query.range(from, to) : await query;
  if (error) throw mapSupabaseError(error);
  if (!categories?.length) return { items: [], total: count ?? 0 };

  const { data: entryCounts, error: countError } = await supabase
    .from("entries")
    .select("category_id")
    .eq("is_deleted", false)
    .in(
      "category_id",
      categories.map((category) => category.id),
    );

  if (countError) throw mapSupabaseError(countError);

  const countMap = buildCountMap(entryCounts ?? [], (entry) => entry.category_id);

  return {
    items: categories.map((category) => ({
      ...category,
      entry_count: countMap.get(category.id) ?? 0,
    })),
    total: count ?? categories.length,
  };
}

export async function getAccountingCategoryById(
  supabase: SupabaseClient<Database>,
  id: string,
) {
  const { data, error } = await supabase
    .from("accounting_categories")
    .select("id, name, type, description, is_active, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw mapSupabaseError(error);
  return data;
}

export async function listActiveAccountingCategoriesByType(
  supabase: SupabaseClient<Database>,
  type: "income" | "expense",
) {
  const { data, error } = await supabase
    .from("accounting_categories")
    .select("id, name, type")
    .eq("type", type)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw mapSupabaseError(error);
  return data ?? [];
}

export async function createAccountingCategory(
  supabase: SupabaseClient<Database>,
  input: {
    name: string;
    type: "income" | "expense";
    description?: string | null;
    isActive: boolean;
    companyId: string;
    userId: string;
  },
) {
  const { data, error } = await supabase
    .from("accounting_categories")
    .insert({
      company_id: input.companyId,
      name: input.name.trim(),
      type: input.type,
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

export async function updateAccountingCategory(
  supabase: SupabaseClient<Database>,
  id: string,
  input: {
    name: string;
    type: "income" | "expense";
    description?: string | null;
    isActive: boolean;
    userId: string;
  },
) {
  const { error } = await supabase
    .from("accounting_categories")
    .update({
      name: input.name.trim(),
      type: input.type,
      description: input.description?.trim() || null,
      is_active: input.isActive,
      updated_by: input.userId,
    })
    .eq("id", id);

  if (error) throw mapSupabaseError(error);
}

export async function deleteAccountingCategory(
  supabase: SupabaseClient<Database>,
  id: string,
) {
  const { error } = await supabase
    .from("accounting_categories")
    .delete()
    .eq("id", id);

  if (error) throw mapSupabaseError(error);
}

export async function countCategoryEntries(
  supabase: SupabaseClient<Database>,
  categoryId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("entries")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId)
    .eq("is_deleted", false);

  if (error) throw mapSupabaseError(error);
  return count ?? 0;
}
