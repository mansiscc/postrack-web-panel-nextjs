import { headers } from "next/headers";

import { logActivity } from "@/lib/activity-log";
import {
  countAccountEntries,
  createAccount,
  deleteAccount,
  getAccountById,
  listAccounts,
  updateAccount,
} from "@/repositories/accounts.repository";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/types/auth";
import { AppError } from "@/utils/errors";

type AccountInput = {
  name: string;
  description?: string | null;
  openingBalance: number;
  isActive: boolean;
};

export async function getAccountsList(params?: {
  search?: string;
  status?: "all" | "active" | "inactive";
}) {
  const supabase = await createClient();
  return listAccounts(supabase, params);
}

export async function createAccountRecord(
  user: SessionUser,
  input: AccountInput,
) {
  const supabase = await createClient();
  const id = await createAccount(supabase, {
    ...input,
    companyId: user.companyId,
    userId: user.id,
  });

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Create",
    moduleName: "Bank Accounts",
    description: `Created account "${input.name}"`,
    status: "Success",
    recordId: id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  return id;
}

export async function updateAccountRecord(
  user: SessionUser,
  id: string,
  input: AccountInput,
) {
  const supabase = await createClient();
  const existing = await getAccountById(supabase, id);
  if (!existing) throw new AppError("Account not found", "NOT_FOUND", 404);

  await updateAccount(supabase, id, { ...input, userId: user.id });

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Update",
    moduleName: "Bank Accounts",
    description: `Updated account "${input.name}"`,
    status: "Success",
    recordId: id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}

export async function toggleAccountActive(
  user: SessionUser,
  id: string,
  isActive: boolean,
) {
  const supabase = await createClient();
  const existing = await getAccountById(supabase, id);
  if (!existing) throw new AppError("Account not found", "NOT_FOUND", 404);

  await updateAccount(supabase, id, {
    name: existing.name,
    description: existing.description,
    openingBalance: existing.opening_balance ?? 0,
    isActive,
    userId: user.id,
  });

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Update",
    moduleName: "Bank Accounts",
    description: `${isActive ? "Activated" : "Deactivated"} account "${existing.name}"`,
    status: "Success",
    recordId: id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}

export async function removeAccount(user: SessionUser, id: string) {
  const supabase = await createClient();
  const existing = await getAccountById(supabase, id);
  if (!existing) throw new AppError("Account not found", "NOT_FOUND", 404);

  if (existing.is_default) {
    throw new AppError("Default accounts cannot be deleted.", "DEFAULT_ACCOUNT");
  }

  const entryCount = await countAccountEntries(supabase, id);
  if (entryCount > 0) {
    throw new AppError(
      `Cannot delete account with ${entryCount} linked transaction(s).`,
      "ACCOUNT_IN_USE",
    );
  }

  await deleteAccount(supabase, id);

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Delete",
    moduleName: "Bank Accounts",
    description: `Deleted account "${existing.name}"`,
    status: "Success",
    recordId: id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}
