import { redirect } from "next/navigation";

import { getDefaultHomePath, getSessionUser, requireSessionUser } from "@/lib/auth/session";
import type { SessionUser } from "@/types/auth";

export async function getAdminUser(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || user.role !== "Admin") return null;
  return user;
}

export async function getAdminOrManagerUser(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || (user.role !== "Admin" && user.role !== "Manager")) {
    return null;
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (user.role !== "Admin") {
    redirect(getDefaultHomePath(user));
  }
  return user;
}

export async function requireAdminOrManager(): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (user.role !== "Admin" && user.role !== "Manager") {
    redirect(getDefaultHomePath(user));
  }
  return user;
}
