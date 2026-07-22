"use server";

import { revalidatePath } from "next/cache";

import { returnBillSchema, saveBillSchema } from "@/features/billing/schema";
import { requireModuleAccess } from "@/lib/auth/session";
import { saveBill, getBillingProductBatches, getBillDetail } from "@/services/billing.service";
import { processBillReturn } from "@/services/return.service";
import { actionError, actionSuccess, type ActionResult } from "@/utils/action-result";
import { AppError, getErrorMessage } from "@/utils/errors";

export async function saveBillAction(
  input: unknown,
): Promise<ActionResult<{ id: string; billNumber: string | null }>> {
  try {
    const user = await requireModuleAccess("billing");
    const parsed = saveBillSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const bill = await saveBill(user, parsed.data);
    revalidatePath("/billing");
    revalidatePath("/sales");
    revalidatePath("/products");
    revalidatePath("/inventory");
    return actionSuccess({ id: bill.id, billNumber: bill.bill_number });
  } catch (error) {
    if (error instanceof AppError) return actionError(error.message);
    return actionError(getErrorMessage(error));
  }
}

export async function getProductBatchesAction(productId: string) {
  await requireModuleAccess("billing");
  return getBillingProductBatches(productId);
}

export async function getBillDetailAction(id: string) {
  await requireModuleAccess("sales");
  return getBillDetail(id);
}

export async function processReturnAction(
  input: unknown,
): Promise<ActionResult<{ returnNumber: string }>> {
  try {
    const user = await requireModuleAccess("sales");
    const parsed = returnBillSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const result = await processBillReturn(user, parsed.data);
    revalidatePath("/sales");
    revalidatePath("/products");
    revalidatePath("/inventory");
    return actionSuccess({ returnNumber: result.returnNumber });
  } catch (error) {
    if (error instanceof AppError) return actionError(error.message);
    return actionError(getErrorMessage(error));
  }
}
