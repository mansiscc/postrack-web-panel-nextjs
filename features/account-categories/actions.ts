"use server";

import { revalidatePath } from "next/cache";

import { accountingCategorySchema } from "@/features/account-categories/schema";
import { requireAdmin, requireAdminOrManager } from "@/lib/auth/guards";
import {
  createAccountingCategoryRecord,
  removeAccountingCategory,
  toggleAccountingCategoryActive,
  updateAccountingCategoryRecord,
} from "@/services/accounting-category.service";
import { actionError, actionSuccess, type ActionResult } from "@/utils/action-result";
import { AppError, getErrorMessage } from "@/utils/errors";

export async function createAccountingCategoryAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdminOrManager();
    const parsed = accountingCategorySchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const id = await createAccountingCategoryRecord(user, parsed.data);
    revalidatePath("/account-categories");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function updateAccountingCategoryAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireAdminOrManager();
    const parsed = accountingCategorySchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    await updateAccountingCategoryRecord(user, id, parsed.data);
    revalidatePath("/account-categories");
    return actionSuccess(undefined);
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function toggleAccountingCategoryActiveAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    const user = await requireAdminOrManager();
    await toggleAccountingCategoryActive(user, id, isActive);
    revalidatePath("/account-categories");
    return actionSuccess(undefined);
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function deleteAccountingCategoryAction(
  id: string,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await removeAccountingCategory(user, id);
    revalidatePath("/account-categories");
    return actionSuccess(undefined);
  } catch (error) {
    if (error instanceof AppError) {
      return actionError(error.message);
    }
    return actionError(getErrorMessage(error));
  }
}
