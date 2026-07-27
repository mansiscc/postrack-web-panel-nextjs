"use server";

import { revalidatePath } from "next/cache";

import { transactionSchema } from "@/hooks/features/transactions/schema";
import { requireAdmin, requireAdminOrManager } from "@/lib/auth/guards";
import {
  createManualTransaction,
  removeManualTransaction,
  updateManualTransaction,
} from "@/services/transaction.service";
import { actionError, actionSuccess, type ActionResult } from "@/utils/action-result";
import { AppError, getErrorMessage } from "@/utils/errors";

export async function createTransactionAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdminOrManager();
    const parsed = transactionSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const id = await createManualTransaction(user, parsed.data);
    revalidatePath("/transactions");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function updateTransactionAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const parsed = transactionSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    await updateManualTransaction(user, id, parsed.data);
    revalidatePath("/transactions");
    return actionSuccess(undefined);
  } catch (error) {
    if (error instanceof AppError) {
      return actionError(error.message);
    }
    return actionError(getErrorMessage(error));
  }
}

export async function deleteTransactionAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await removeManualTransaction(user, id);
    revalidatePath("/transactions");
    return actionSuccess(undefined);
  } catch (error) {
    if (error instanceof AppError) {
      return actionError(error.message);
    }
    return actionError(getErrorMessage(error));
  }
}
