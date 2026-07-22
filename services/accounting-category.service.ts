import { headers } from "next/headers";

import { logActivity } from "@/lib/activity-log";
import {
  countCategoryEntries,
  createAccountingCategory,
  deleteAccountingCategory,
  getAccountingCategoryById,
  listAccountingCategories,
  updateAccountingCategory,
} from "@/repositories/accounting-categories.repository";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/types/auth";
import { AppError } from "@/utils/errors";

type AccountingCategoryInput = {
  name: string;
  type: "income" | "expense";
  description?: string | null;
  isActive: boolean;
};

export async function getAccountingCategoriesList(params?: {
  search?: string;
  type?: "all" | "income" | "expense";
  status?: "all" | "active" | "inactive";
}) {
  const supabase = await createClient();
  return listAccountingCategories(supabase, params);
}

export async function createAccountingCategoryRecord(
  user: SessionUser,
  input: AccountingCategoryInput,
) {
  const supabase = await createClient();
  const id = await createAccountingCategory(supabase, {
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
    moduleName: "Account Categories",
    description: `Created ${input.type} category "${input.name}"`,
    status: "Success",
    recordId: id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  return id;
}

export async function updateAccountingCategoryRecord(
  user: SessionUser,
  id: string,
  input: AccountingCategoryInput,
) {
  const supabase = await createClient();
  const existing = await getAccountingCategoryById(supabase, id);
  if (!existing) {
    throw new AppError("Account category not found", "NOT_FOUND", 404);
  }

  await updateAccountingCategory(supabase, id, { ...input, userId: user.id });

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Update",
    moduleName: "Account Categories",
    description: `Updated category "${input.name}"`,
    status: "Success",
    recordId: id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}

export async function toggleAccountingCategoryActive(
  user: SessionUser,
  id: string,
  isActive: boolean,
) {
  const supabase = await createClient();
  const existing = await getAccountingCategoryById(supabase, id);
  if (!existing) {
    throw new AppError("Account category not found", "NOT_FOUND", 404);
  }

  await updateAccountingCategory(supabase, id, {
    name: existing.name,
    type: existing.type,
    description: existing.description,
    isActive,
    userId: user.id,
  });

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Update",
    moduleName: "Account Categories",
    description: `${isActive ? "Activated" : "Deactivated"} category "${existing.name}"`,
    status: "Success",
    recordId: id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}

export async function removeAccountingCategory(user: SessionUser, id: string) {
  const supabase = await createClient();
  const existing = await getAccountingCategoryById(supabase, id);
  if (!existing) {
    throw new AppError("Account category not found", "NOT_FOUND", 404);
  }

  const entryCount = await countCategoryEntries(supabase, id);
  if (entryCount > 0) {
    throw new AppError(
      `Cannot delete category with ${entryCount} linked transaction(s).`,
      "CATEGORY_IN_USE",
    );
  }

  await deleteAccountingCategory(supabase, id);

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Delete",
    moduleName: "Account Categories",
    description: `Deleted category "${existing.name}"`,
    status: "Success",
    recordId: id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}
