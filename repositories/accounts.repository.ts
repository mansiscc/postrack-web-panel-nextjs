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

export type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];

export type AccountListRow = AccountRow & {
  entry_count: number;
};

type ListParams = SearchListParams & PaginationParams;

export async function listAccounts(
  supabase: SupabaseClient<Database>,
  params: ListParams = {},
): Promise<ListResult<AccountListRow>> {
  const { paginate, from, to } = resolvePaginationRange(params);

  let query = supabase
    .from("accounts")
    .select("*", { count: "exact" })
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  query = applyNameIlikeFilter(query, params.search);
  query = applyActiveStatusFilter(query, params.status);

  const {
    data: accounts,
    error,
    count,
  } = paginate ? await query.range(from, to) : await query;
  if (error) throw mapSupabaseError(error);
  if (!accounts?.length) return { items: [], total: count ?? 0 };

  const { data: entryCounts, error: countError } = await supabase
    .from("entries")
    .select("account_id")
    .eq("is_deleted", false)
    .in(
      "account_id",
      accounts.map((account) => account.id),
    );

  if (countError) throw mapSupabaseError(countError);

  const countMap = buildCountMap(entryCounts ?? [], (entry) => entry.account_id);

  return {
    items: accounts.map((account) => ({
      ...account,
      entry_count: countMap.get(account.id) ?? 0,
    })),
    total: count ?? accounts.length,
  };
}

export async function listActiveAccounts(
  supabase: SupabaseClient<Database>,
): Promise<AccountRow[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw mapSupabaseError(error);
  return data ?? [];
}

export async function getAccountById(
  supabase: SupabaseClient<Database>,
  id: string,
) {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw mapSupabaseError(error);
  return data;
}

export async function getDefaultAccount(
  supabase: SupabaseClient<Database>,
): Promise<AccountRow | null> {
  const { data: defaultAccounts, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .eq("is_default", true)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw mapSupabaseError(error);
  if (defaultAccounts?.[0]) return defaultAccounts[0];

  const { data: cashAccounts, error: cashError } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .eq("name", "Cash in Hand")
    .limit(1);

  if (cashError) throw mapSupabaseError(cashError);
  return cashAccounts?.[0] ?? null;
}

export async function createAccount(
  supabase: SupabaseClient<Database>,
  input: {
    name: string;
    description?: string | null;
    openingBalance: number;
    isActive: boolean;
    companyId: string;
    userId: string;
  },
) {
  const { data, error } = await supabase
    .from("accounts")
    .insert({
      company_id: input.companyId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      opening_balance: input.openingBalance,
      is_default: false,
      is_active: input.isActive,
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select("id")
    .single();

  if (error) throw mapSupabaseError(error);
  return data.id;
}

export async function updateAccount(
  supabase: SupabaseClient<Database>,
  id: string,
  input: {
    name: string;
    description?: string | null;
    openingBalance: number;
    isActive: boolean;
    userId: string;
  },
) {
  const { error } = await supabase
    .from("accounts")
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      opening_balance: input.openingBalance,
      is_active: input.isActive,
      updated_by: input.userId,
    })
    .eq("id", id);

  if (error) throw mapSupabaseError(error);
}

export async function deleteAccount(
  supabase: SupabaseClient<Database>,
  id: string,
) {
  const { error } = await supabase.from("accounts").delete().eq("id", id);

  if (error) throw mapSupabaseError(error);
}

export async function countAccountEntries(
  supabase: SupabaseClient<Database>,
  accountId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("entries")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("is_deleted", false);

  if (error) throw mapSupabaseError(error);
  return count ?? 0;
}
