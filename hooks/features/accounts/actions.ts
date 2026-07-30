"use server";

import { revalidatePath } from "next/cache";

import { accountSchema } from "@/hooks/features/accounts/schema";
import { requireAdmin, requireAdminOrManager } from "@/lib/auth/guards";
import {
  createAccountRecord,
  removeAccount,
  toggleAccountActive,
  updateAccountRecord,
} from "@/services/account.service";
import { getTransactionsList } from "@/services/transaction.service";
import { actionError, actionSuccess, type ActionResult } from "@/utils/action-result";
import { AppError, getErrorMessage } from "@/utils/errors";

export async function createAccountAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdminOrManager();
    const parsed = accountSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const id = await createAccountRecord(user, parsed.data);
    revalidatePath("/accounts");
    return actionSuccess({ id });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function updateAccountAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireAdminOrManager();
    const parsed = accountSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    await updateAccountRecord(user, id, parsed.data);
    revalidatePath("/accounts");
    return actionSuccess(undefined);
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function toggleAccountActiveAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    const user = await requireAdminOrManager();
    await toggleAccountActive(user, id, isActive);
    revalidatePath("/accounts");
    revalidatePath(`/accounts/${id}`);
    return actionSuccess(undefined);
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function deleteAccountAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await removeAccount(user, id);
    revalidatePath("/accounts");
    return actionSuccess(undefined);
  } catch (error) {
    if (error instanceof AppError) {
      return actionError(error.message);
    }
    return actionError(getErrorMessage(error));
  }
}

export async function getAccountLedgerAction(accountId: string) {
  await requireAdminOrManager();
  const rows = await getTransactionsList({ accountId });
  return rows.slice(0, 50);
}
