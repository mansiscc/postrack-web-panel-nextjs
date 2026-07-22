import { headers } from "next/headers";

import { logActivity } from "@/lib/activity-log";
import {
  countCategoryProducts,
  createCategory,
  deleteCategory,
  getCategoryById,
  listCategories,
  updateCategory,
} from "@/repositories/categories.repository";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/types/auth";
import { AppError } from "@/utils/errors";

type CategoryInput = {
  name: string;
  description?: string | null;
  isActive: boolean;
};

export async function getCategoriesList(params?: {
  search?: string;
  status?: "all" | "active" | "inactive";
}) {
  const supabase = await createClient();
  return listCategories(supabase, params);
}

export async function createCategoryRecord(
  user: SessionUser,
  input: CategoryInput,
) {
  const supabase = await createClient();
  const id = await createCategory(supabase, {
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
    moduleName: "Categories",
    description: `Created category "${input.name}"`,
    status: "Success",
    recordId: id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  return id;
}

export async function updateCategoryRecord(
  user: SessionUser,
  id: string,
  input: CategoryInput,
) {
  const supabase = await createClient();
  const existing = await getCategoryById(supabase, id);
  if (!existing) throw new AppError("Category not found", "NOT_FOUND", 404);

  await updateCategory(supabase, id, { ...input, userId: user.id });

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Update",
    moduleName: "Categories",
    description: `Updated category "${input.name}"`,
    status: "Success",
    recordId: id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}

export async function toggleCategoryActive(
  user: SessionUser,
  id: string,
  isActive: boolean,
) {
  const supabase = await createClient();
  const existing = await getCategoryById(supabase, id);
  if (!existing) throw new AppError("Category not found", "NOT_FOUND", 404);

  await updateCategory(supabase, id, {
    name: existing.name,
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
    moduleName: "Categories",
    description: `${isActive ? "Activated" : "Deactivated"} category "${existing.name}"`,
    status: "Success",
    recordId: id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}

export async function removeCategory(user: SessionUser, id: string) {
  const supabase = await createClient();
  const existing = await getCategoryById(supabase, id);
  if (!existing) throw new AppError("Category not found", "NOT_FOUND", 404);

  const productCount = await countCategoryProducts(supabase, id);
  if (productCount > 0) {
    throw new AppError(
      `Cannot delete category with ${productCount} linked product(s). Reassign products first.`,
      "CATEGORY_IN_USE",
    );
  }

  await deleteCategory(supabase, id);

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Delete",
    moduleName: "Categories",
    description: `Deleted category "${existing.name}"`,
    status: "Success",
    recordId: id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}
