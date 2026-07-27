"use server";

import { revalidatePath } from "next/cache";

import { customerSchema } from "@/hooks/features/customers/schema";
import { requireModuleAccess } from "@/lib/auth/session";
import {
  createCustomerRecord,
  getCustomerDetail,
  updateCustomerRecord,
} from "@/services/customer.service";
import { actionError, actionSuccess, type ActionResult } from "@/utils/action-result";
import { AppError, getErrorMessage } from "@/utils/errors";

export async function createCustomerAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireModuleAccess("customers");
    const parsed = customerSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const id = await createCustomerRecord(user, parsed.data);
    revalidatePath("/customers");
    return actionSuccess({ id });
  } catch (error) {
    if (error instanceof AppError) return actionError(error.message);
    return actionError(getErrorMessage(error));
  }
}

export async function updateCustomerAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireModuleAccess("customers");
    const parsed = customerSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    await updateCustomerRecord(user, id, parsed.data);
    revalidatePath("/customers");
    return actionSuccess(undefined);
  } catch (error) {
    if (error instanceof AppError) return actionError(error.message);
    return actionError(getErrorMessage(error));
  }
}

export async function getCustomerDetailsAction(id: string) {
  await requireModuleAccess("customers");
  return getCustomerDetail(id);
}
