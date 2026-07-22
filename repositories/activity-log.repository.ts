import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import type { Database } from "@/types/database.types";
import { mapSupabaseError } from "@/utils/errors";
import { sanitizePostgrestSearch } from "@/utils/postgrest-filter";

export type ActivityLogRow = Database["public"]["Tables"]["activity_log"]["Row"];

export type ActivityLogActionType = ActivityLogRow["action_type"];
export type ActivityLogStatus = ActivityLogRow["status"];

export type ActivityLogFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  actionType?: ActivityLogActionType | "all";
  moduleName?: string;
  status?: ActivityLogStatus | "all";
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type ActivityLogListResult = {
  items: ActivityLogRow[];
  total: number;
};

const ACTION_TYPES = ["Create", "Update", "Delete", "Login", "Logout"] as const;
const STATUSES = ["Success", "Failed"] as const;

export function parseActivityLogActionType(
  value: string | null | undefined,
): ActivityLogFilters["actionType"] {
  if (!value || value === "all") return undefined;
  return (ACTION_TYPES as readonly string[]).includes(value)
    ? (value as ActivityLogActionType)
    : undefined;
}

export function parseActivityLogStatus(
  value: string | null | undefined,
): ActivityLogFilters["status"] {
  if (!value || value === "all") return undefined;
  return (STATUSES as readonly string[]).includes(value)
    ? (value as ActivityLogStatus)
    : undefined;
}

export async function listActivityLogs(
  supabase: SupabaseClient<Database>,
  filters: ActivityLogFilters = {},
): Promise<ActivityLogListResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("activity_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters.search?.trim()) {
    const term = sanitizePostgrestSearch(filters.search);
    if (term) {
      query = query.or(
        `description.ilike.%${term}%,user_name.ilike.%${term}%,module_name.ilike.%${term}%`,
      );
    }
  }

  if (filters.actionType && filters.actionType !== "all") {
    query = query.eq("action_type", filters.actionType);
  }

  if (filters.moduleName && filters.moduleName !== "all") {
    query = query.eq("module_name", filters.moduleName);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.userId && filters.userId !== "all") {
    query = query.eq("user_id", filters.userId);
  }

  if (filters.dateFrom) {
    query = query.gte("created_at", `${filters.dateFrom}T00:00:00`);
  }

  if (filters.dateTo) {
    query = query.lte("created_at", `${filters.dateTo}T23:59:59`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw mapSupabaseError(error);

  return {
    items: data ?? [],
    total: count ?? 0,
  };
}

export async function listActivityLogUsers(
  supabase: SupabaseClient<Database>,
): Promise<Array<{ id: string; full_name: string }>> {
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("is_deleted", false)
    .order("full_name");

  if (error) throw mapSupabaseError(error);
  return data ?? [];
}

export async function listActivityLogModules(
  supabase: SupabaseClient<Database>,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("module_name")
    .order("module_name");

  if (error) throw mapSupabaseError(error);

  const modules = new Set<string>();
  for (const row of data ?? []) {
    if (row.module_name) modules.add(row.module_name);
  }
  return Array.from(modules).sort();
}
