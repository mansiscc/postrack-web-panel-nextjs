import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { ListResult, PaginationParams } from "@/types/list-params";
import { mapSupabaseError } from "@/utils/errors";
import { sanitizePostgrestSearch } from "@/utils/postgrest-filter";
import { resolvePaginationRange } from "@/utils/repository-query";

export type UserListRow =
  Database["public"]["Views"]["user_list_with_permissions_view"]["Row"];

type UserRole = UserListRow["role"];
type UserStatus = UserListRow["status"];

export type UserListParams = PaginationParams & {
  search?: string;
  role?: UserRole | "all";
  status?: UserStatus | "all" | "deleted";
  includeDeleted?: boolean;
};

export async function listUsers(
  supabase: SupabaseClient<Database>,
  params: UserListParams = {},
): Promise<ListResult<UserListRow>> {
  const { paginate, from, to } = resolvePaginationRange(params);

  let query = supabase
    .from("user_list_with_permissions_view")
    .select("*", { count: "exact" })
    .order("full_name", { ascending: true });

  if (params.status === "deleted") {
    query = query.eq("is_deleted", true);
  } else if (params.status === "Active" || params.status === "Inactive") {
    query = query.eq("is_deleted", false).eq("status", params.status);
  } else if (!params.includeDeleted) {
    query = query.eq("is_deleted", false);
  }

  if (params.search?.trim()) {
    const term = sanitizePostgrestSearch(params.search);
    if (term) {
      query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
    }
  }

  if (params.role && params.role !== "all") {
    query = query.eq("role", params.role);
  }

  const { data, error, count } = paginate
    ? await query.range(from, to)
    : await query;
  if (error) throw mapSupabaseError(error);

  const items = data ?? [];
  return { items, total: count ?? items.length };
}

export async function getUserById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<UserListRow | null> {
  const { data, error } = await supabase
    .from("user_list_with_permissions_view")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw mapSupabaseError(error);
  return data;
}

export async function updateUserRecord(
  supabase: SupabaseClient<Database>,
  id: string,
  input: {
    fullName: string;
    phone?: string | null;
    role: "Admin" | "Manager" | "Staff";
    status: "Active" | "Inactive";
  },
) {
  const { error } = await supabase
    .from("users")
    .update({
      full_name: input.fullName.trim(),
      phone: input.phone?.trim() || null,
      role: input.role,
      status: input.status,
    })
    .eq("id", id);

  if (error) throw mapSupabaseError(error);
}

export async function replaceUserPermissions(
  supabase: SupabaseClient<Database>,
  userId: string,
  permissions: Array<"stock_in" | "stock_out">,
) {
  const { error: deleteError } = await supabase
    .from("user_permissions")
    .delete()
    .eq("user_id", userId);

  if (deleteError) throw mapSupabaseError(deleteError);

  if (permissions.length === 0) return;

  const { error: insertError } = await supabase.from("user_permissions").insert(
    permissions.map((permission) => ({
      user_id: userId,
      permission,
      granted: true,
    })),
  );

  if (insertError) throw mapSupabaseError(insertError);
}

export async function restoreUserRecord(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { error } = await supabase.rpc("restore_user", {
    p_user_id: userId,
  });

  if (error) throw mapSupabaseError(error);
}
