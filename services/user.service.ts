import { headers } from "next/headers";

import { logActivity } from "@/lib/activity-log";
import {
  getUserById,
  listUsers,
  replaceUserPermissions,
  restoreUserRecord,
  updateUserRecord,
  type UserListParams,
} from "@/repositories/users.repository";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser, StaffPermission } from "@/types/auth";
import { AppError } from "@/utils/errors";

type CreateUserInput = {
  fullName: string;
  email: string;
  password: string;
  phone?: string | null;
  role: "Admin" | "Manager" | "Staff";
  status: "Active" | "Inactive";
  permissionStockIn: boolean;
  permissionStockOut: boolean;
};

type UpdateUserInput = {
  fullName: string;
  phone?: string | null;
  role: "Admin" | "Manager" | "Staff";
  status: "Active" | "Inactive";
  permissionStockIn: boolean;
  permissionStockOut: boolean;
};

function toPermissions(input: {
  permissionStockIn: boolean;
  permissionStockOut: boolean;
}): StaffPermission[] {
  const permissions: StaffPermission[] = [];
  if (input.permissionStockIn) permissions.push("stock_in");
  if (input.permissionStockOut) permissions.push("stock_out");
  return permissions;
}

export async function getUsersList(params?: UserListParams) {
  const supabase = await createClient();
  return listUsers(supabase, params);
}

export async function createUserRecord(
  actor: SessionUser,
  input: CreateUserInput,
) {
  const supabase = await createClient();

  const { data, error } = await supabase.functions.invoke("create-user", {
    body: {
      fullName: input.fullName,
      email: input.email,
      password: input.password,
      phone: input.phone ?? null,
      role: input.role,
      status: input.status,
      createdBy: actor.id,
      permissionStockIn: input.permissionStockIn,
      permissionStockOut: input.permissionStockOut,
    },
  });

  if (error) {
    throw new AppError(error.message, "EDGE_FUNCTION_ERROR");
  }

  if (data && typeof data === "object" && "error" in data) {
    throw new AppError(String(data.error), "EDGE_FUNCTION_ERROR");
  }

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: actor.id,
    userName: actor.fullName,
    companyId: actor.companyId,
    actionType: "Create",
    moduleName: "Users",
    description: `Created user "${input.fullName}"`,
    status: "Success",
    recordId: typeof data?.id === "string" ? data.id : undefined,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  return data;
}

export async function updateUserRecordService(
  actor: SessionUser,
  userId: string,
  input: UpdateUserInput,
) {
  const supabase = await createClient();
  const existing = await getUserById(supabase, userId);

  if (!existing) throw new AppError("User not found", "NOT_FOUND", 404);
  if (existing.is_deleted) {
    throw new AppError("Restore the user before editing", "USER_DELETED");
  }

  await updateUserRecord(supabase, userId, input);

  if (input.role === "Staff") {
    await replaceUserPermissions(
      supabase,
      userId,
      toPermissions(input),
    );
  } else {
    await replaceUserPermissions(supabase, userId, []);
  }

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: actor.id,
    userName: actor.fullName,
    companyId: actor.companyId,
    actionType: "Update",
    moduleName: "Users",
    description: `Updated user "${input.fullName}"`,
    status: "Success",
    recordId: userId,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}

export async function deleteUserRecord(actor: SessionUser, userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.functions.invoke("delete-user", {
    body: { user_id: userId },
  });

  if (error) {
    throw new AppError(error.message, "EDGE_FUNCTION_ERROR");
  }

  if (data && typeof data === "object" && "error" in data) {
    throw new AppError(String(data.error), "EDGE_FUNCTION_ERROR");
  }

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: actor.id,
    userName: actor.fullName,
    companyId: actor.companyId,
    actionType: "Delete",
    moduleName: "Users",
    description: `Deleted user (${userId})`,
    status: "Success",
    recordId: userId,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  return data;
}

export async function restoreUserRecordService(
  actor: SessionUser,
  userId: string,
) {
  const supabase = await createClient();
  await restoreUserRecord(supabase, userId);

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: actor.id,
    userName: actor.fullName,
    companyId: actor.companyId,
    actionType: "Update",
    moduleName: "Users",
    description: `Restored user (${userId})`,
    status: "Success",
    recordId: userId,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}

export async function changeUserPassword(
  actor: SessionUser,
  userId: string,
  newPassword: string,
) {
  const supabase = await createClient();

  const { data, error } = await supabase.functions.invoke(
    "change-user-password",
    {
      body: { user_id: userId, new_password: newPassword },
    },
  );

  if (error) {
    throw new AppError(error.message, "EDGE_FUNCTION_ERROR");
  }

  if (data && typeof data === "object" && "error" in data) {
    throw new AppError(String(data.error), "EDGE_FUNCTION_ERROR");
  }

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: actor.id,
    userName: actor.fullName,
    companyId: actor.companyId,
    actionType: "Update",
    moduleName: "Users",
    description: `Changed password for user (${userId})`,
    status: "Success",
    recordId: userId,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}
