"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { loginSchema } from "@/hooks/features/auth/schema";
import { logActivity } from "@/lib/activity-log";
import {
  fetchUserProfile,
  isUserAccountActive,
} from "@/lib/auth/fetch-profile";
import { getDefaultHomePath } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/utils/errors";

export type AuthActionResult =
  | { success: true; redirectTo: string }
  | { success: false; error: string };

export async function loginAction(
  input: unknown,
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid login details",
    };
  }

  const { email, password } = parsed.data;
  const supabase = await createClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return {
      success: false,
      error: "Invalid email or password",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unable to start session. Try again." };
  }

  const profile = await fetchUserProfile(supabase, user.id);

  if (!profile) {
    await supabase.auth.signOut();
    return {
      success: false,
      error: "Your account is not linked to a store user profile.",
    };
  }

  if (!isUserAccountActive(profile)) {
    await supabase.auth.signOut();
    return {
      success: false,
      error: "Your account is inactive. Contact your store administrator.",
    };
  }

  if (!profile.companyIsActive) {
    await logActivity(supabase, {
      userId: profile.id,
      userName: profile.fullName,
      companyId: profile.companyId,
      actionType: "Login",
      moduleName: "Auth",
      description: "Login blocked — company inactive",
      status: "Failed",
    });
    redirect("/inactive");
  }

  const headerStore = await headers();
  const ipAddress =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

  await logActivity(supabase, {
    userId: profile.id,
    userName: profile.fullName,
    companyId: profile.companyId,
    actionType: "Login",
    moduleName: "Auth",
    description: "User logged in",
    status: "Success",
    ipAddress,
  });

  return { success: true, redirectTo: getDefaultHomePath(profile) };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const profile = await fetchUserProfile(supabase, user.id);
    if (profile) {
      const headerStore = await headers();
      const ipAddress =
        headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

      await logActivity(supabase, {
        userId: profile.id,
        userName: profile.fullName,
        companyId: profile.companyId,
        actionType: "Logout",
        moduleName: "Auth",
        description: "User logged out",
        status: "Success",
        ipAddress,
      });
    }
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(getErrorMessage(error));
  }

  redirect("/login");
}
