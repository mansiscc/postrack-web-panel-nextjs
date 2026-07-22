import { redirect } from "next/navigation";

import { fetchUserProfile, isUserAccountActive } from "@/lib/auth/fetch-profile";
import { createClient } from "@/lib/supabase/server";
import type { ModuleKey, SessionUser } from "@/types/auth";
import { canAccessModule } from "@/utils/permissions";

export async function getAuthProfile(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const profile = await fetchUserProfile(supabase, user.id);
  if (!profile || !isUserAccountActive(profile)) return null;

  return profile;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const profile = await getAuthProfile();
  if (!profile || !profile.companyIsActive) return null;
  return profile;
}

export async function requireSessionUser(): Promise<SessionUser> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");
  return sessionUser;
}

export async function requireModuleAccess(
  module: ModuleKey,
): Promise<SessionUser> {
  const sessionUser = await requireSessionUser();

  if (!canAccessModule(sessionUser.role, sessionUser.permissions, module)) {
    redirect(getDefaultHomePath(sessionUser));
  }

  return sessionUser;
}

/** First permitted module for post-login / unauthorized redirects. */
export function getDefaultHomePath(user: SessionUser): string {
  if (user.role === "Admin") return "/";
  if (user.role === "Manager") return "/products";
  if (user.permissions.includes("stock_out")) return "/billing";
  if (user.permissions.includes("stock_in")) return "/products";
  return "/login";
}
