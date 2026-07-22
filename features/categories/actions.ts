"use server";

import { revalidatePath } from "next/cache";

import { categorySchema } from "@/features/categories/schema";
import { requireAdminOrManager, requireAdmin } from "@/lib/auth/guards";
import {
  createCategoryRecord,
  removeCategory,
  toggleCategoryActive,
  updateCategoryRecord,
} from "@/services/category.service";
import { actionError, actionSuccess, type ActionResult } from "@/utils/action-result";
import { AppError, getErrorMessage } from "@/utils/errors";

export async function createCategoryAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdminOrManager();
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const id = await createCategoryRecord(user, parsed.data);
    revalidatePath("/categories");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function updateCategoryAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireAdminOrManager();
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    await updateCategoryRecord(user, id, parsed.data);
    revalidatePath("/categories");
    return actionSuccess(undefined);
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function toggleCategoryActiveAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    const user = await requireAdminOrManager();
    await toggleCategoryActive(user, id, isActive);
    revalidatePath("/categories");
    return actionSuccess(undefined);
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await removeCategory(user, id);
    revalidatePath("/categories");
    return actionSuccess(undefined);
  } catch (error) {
    if (error instanceof AppError) {
      return actionError(error.message);
    }
    return actionError(getErrorMessage(error));
  }
}
