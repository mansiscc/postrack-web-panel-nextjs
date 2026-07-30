"use server";

import { revalidatePath } from "next/cache";

import { createPurchaseSchema } from "@/hooks/features/purchases/schema";
import { requireModuleAccess } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getProductBatchesWithStock } from "@/repositories/products.repository";
import {
  createPurchaseRecord,
  getPurchaseDetail,
} from "@/services/stock-in.service";
import { actionError, actionSuccess, type ActionResult } from "@/utils/action-result";
import { AppError, getErrorMessage } from "@/utils/errors";

export async function createPurchaseAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireModuleAccess("purchases");
    const parsed = createPurchaseSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const id = await createPurchaseRecord(user, {
      date: parsed.data.date,
      supplierId: parsed.data.supplierId,
      invoiceNumber: parsed.data.invoiceNumber,
      notes: parsed.data.notes,
      accountId: parsed.data.accountId,
      items: parsed.data.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        row_total: item.rowTotal,
        purchase_price: item.purchasePrice,
        selling_price: item.sellingPrice,
        mrp: item.mrp,
        batch_name: item.batchName,
      })),
    });

    revalidatePath("/purchases");
    revalidatePath("/products");
    revalidatePath("/inventory");
    return actionSuccess({ id });
  } catch (error) {
    if (error instanceof AppError) return actionError(error.message);
    return actionError(getErrorMessage(error));
  }
}

export async function getPurchaseDetailsAction(id: string) {
  await requireModuleAccess("purchases");
  return getPurchaseDetail(id);
}

export async function getPurchaseProductBatchesAction(productId: string) {
  await requireModuleAccess("purchases");
  const supabase = await createClient();
  return getProductBatchesWithStock(supabase, productId);
}
