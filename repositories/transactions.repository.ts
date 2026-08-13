import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { mapSupabaseError } from "@/utils/errors";
import {
  sanitizePostgrestSearch,
  toIlikePattern,
} from "@/utils/postgrest-filter";

export type TransactionListRow = {
  id: string;
  entry_date: string;
  entry_type: "income" | "expense";
  account_id: string;
  account_name: string;
  category_id: string;
  category_name: string;
  amount: number;
  remarks: string | null;
  source_type:
    | "bill"
    | "bill_return"
    | "purchase"
    | "manual"
    | "bill_payment"
    | null;
  payment_mode: "Cash" | "UPI" | "Card" | "Mixed" | null;
  created_at: string;
};

export type TransactionTotals = {
  totalEntriesCount: number;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
};

export type TransactionListParams = {
  search?: string;
  entryType?: "all" | "income" | "expense";
  accountId?: string;
  categoryId?: string;
  sourceType?: "all" | "manual" | "system";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export type TransactionListResult = {
  items: TransactionListRow[];
  total: number;
};

export async function listTransactions(
  supabase: SupabaseClient<Database>,
  params: TransactionListParams = {},
): Promise<TransactionListResult> {
  const paginate = params.pageSize != null || params.page != null;
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("entries")
    .select(
      "id, entry_date, entry_type, account_id, category_id, amount, remarks, source_type, payment_mode, created_at",
      { count: "exact" },
    )
    .eq("is_deleted", false)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (params.entryType === "income" || params.entryType === "expense") {
    query = query.eq("entry_type", params.entryType);
  }

  if (params.accountId) {
    query = query.eq("account_id", params.accountId);
  }

  if (params.categoryId) {
    query = query.eq("category_id", params.categoryId);
  }

  if (params.sourceType === "manual") {
    query = query.eq("source_type", "manual");
  } else if (params.sourceType === "system") {
    query = query.neq("source_type", "manual");
  }

  if (params.dateFrom) {
    query = query.gte("entry_date", params.dateFrom);
  }

  if (params.dateTo) {
    query = query.lte("entry_date", params.dateTo);
  }

  if (params.search?.trim()) {
    const term = sanitizePostgrestSearch(params.search);
    if (term) {
      const pattern = toIlikePattern(term);
      const [{ data: matchingAccounts }, { data: matchingCategories }] =
        await Promise.all([
          supabase.from("accounts").select("id").ilike("name", pattern),
          supabase
            .from("accounting_categories")
            .select("id")
            .ilike("name", pattern),
        ]);

      const accountIds = (matchingAccounts ?? []).map((row) => row.id);
      const categoryIds = (matchingCategories ?? []).map((row) => row.id);
      const parts = [`remarks.ilike.%${term}%`];
      if (accountIds.length) {
        parts.push(`account_id.in.(${accountIds.join(",")})`);
      }
      if (categoryIds.length) {
        parts.push(`category_id.in.(${categoryIds.join(",")})`);
      }
      query = query.or(parts.join(","));
    }
  }

  const { data: entries, error, count } = paginate
    ? await query.range(from, to)
    : await query;
  if (error) throw mapSupabaseError(error);
  if (!entries?.length) {
    return { items: [], total: count ?? 0 };
  }

  const accountIds = [...new Set(entries.map((entry) => entry.account_id))];
  const categoryIds = [...new Set(entries.map((entry) => entry.category_id))];

  const [{ data: accounts }, { data: categories }] = await Promise.all([
    supabase.from("accounts").select("id, name").in("id", accountIds),
    supabase
      .from("accounting_categories")
      .select("id, name")
      .in("id", categoryIds),
  ]);

  const accountMap = new Map(
    (accounts ?? []).map((account) => [account.id, account.name]),
  );
  const categoryMap = new Map(
    (categories ?? []).map((category) => [category.id, category.name]),
  );

  const items: TransactionListRow[] = entries.map((entry) => ({
    id: entry.id,
    entry_date: entry.entry_date,
    entry_type: entry.entry_type,
    account_id: entry.account_id,
    account_name: accountMap.get(entry.account_id) ?? "—",
    category_id: entry.category_id,
    category_name: categoryMap.get(entry.category_id) ?? "—",
    amount: entry.amount,
    remarks: entry.remarks,
    source_type: entry.source_type,
    payment_mode: entry.payment_mode,
    created_at: entry.created_at,
  }));

  return {
    items,
    total: count ?? items.length,
  };
}

export async function getTransactionById(
  supabase: SupabaseClient<Database>,
  id: string,
) {
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .eq("id", id)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) throw mapSupabaseError(error);
  return data;
}

export async function getTransactionsTotals(
  supabase: SupabaseClient<Database>,
): Promise<TransactionTotals> {
  const { data, error } = await supabase.rpc("get_transactions_totals");
  if (error) throw mapSupabaseError(error);

  const row = data?.[0];
  const totalIncome = row?.total_income ?? 0;
  const totalExpense = row?.total_expense ?? 0;

  return {
    totalEntriesCount: row?.total_entries_count ?? 0,
    totalIncome,
    totalExpense,
    netBalance: totalIncome - totalExpense,
  };
}

export async function createManualEntry(
  supabase: SupabaseClient<Database>,
  input: Database["public"]["Tables"]["entries"]["Insert"],
) {
  const { data, error } = await supabase
    .from("entries")
    .insert(input)
    .select("id")
    .single();

  if (error) throw mapSupabaseError(error);
  return data.id;
}

export async function updateManualEntry(
  supabase: SupabaseClient<Database>,
  id: string,
  input: Database["public"]["Tables"]["entries"]["Update"],
) {
  const { error } = await supabase.from("entries").update(input).eq("id", id);

  if (error) throw mapSupabaseError(error);
}

export async function softDeleteEntry(
  supabase: SupabaseClient<Database>,
  id: string,
) {
  const { error } = await supabase
    .from("entries")
    .update({
      is_deleted: true,
    })
    .eq("id", id);

  if (error) throw mapSupabaseError(error);
}
