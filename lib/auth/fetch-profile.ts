import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { SessionUser, StaffPermission } from "@/types/auth";

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  role: SessionUser["role"];
  status: SessionUser["status"];
  is_deleted: boolean;
  company_id: string;
  companies: {
    business_name: string;
    is_active: boolean;
  } | null;
};

export async function fetchUserProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<SessionUser | null> {
  const { data: user, error } = await supabase
    .from("users")
    .select(
      `
      id,
      full_name,
      email,
      role,
      status,
      is_deleted,
      company_id,
      companies ( business_name, is_active )
    `,
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !user) return null;

  const profile = user as ProfileRow;

  if (profile.is_deleted) return null;

  const company = profile.companies;

  let permissions: StaffPermission[] = [];
  if (profile.role === "Staff") {
    const { data: permissionRows } = await supabase
      .from("user_permissions")
      .select("permission")
      .eq("user_id", userId)
      .eq("granted", true);

    permissions = (permissionRows ?? [])
      .map((row) => row.permission)
      .filter(
        (permission): permission is StaffPermission =>
          permission === "stock_in" || permission === "stock_out",
      );
  }

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    status: profile.status,
    companyId: profile.company_id,
    companyName: company?.business_name ?? "Store",
    companyIsActive: company?.is_active ?? false,
    permissions,
  };
}

export function isUserAccountActive(profile: {
  status: SessionUser["status"];
}): boolean {
  return profile.status === "Active";
}

export function isUserAllowed(profile: SessionUser): boolean {
  return isUserAccountActive(profile) && profile.companyIsActive;
}
