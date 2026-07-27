"use server";

import { revalidatePath } from "next/cache";

import { supplierSchema } from "@/hooks/features/suppliers/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { requireModuleAccess } from "@/lib/auth/session";
import {
  createSupplierRecord,
  getSupplierDetail,
  removeSupplier,
  restoreSupplierRecord,
  updateSupplierRecord,
} from "@/services/supplier.service";
import { actionError, actionSuccess, type ActionResult } from "@/utils/action-result";
import { AppError, getErrorMessage } from "@/utils/errors";

export async function createSupplierAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireModuleAccess("suppliers");
    const parsed = supplierSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const id = await createSupplierRecord(user, {
      supplierName: parsed.data.supplierName,
      contactPerson: parsed.data.contactPerson,
      phone: parsed.data.phone,
      email: parsed.data.email,
      address: parsed.data.address,
      gstNumber: parsed.data.gstNumber,
      openingBalance: parsed.data.openingBalance,
    });

    revalidatePath("/suppliers");
    return actionSuccess({ id });
  } catch (error) {
    if (error instanceof AppError) return actionError(error.message);
    return actionError(getErrorMessage(error));
  }
}

export async function updateSupplierAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireModuleAccess("suppliers");
    const parsed = supplierSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    await updateSupplierRecord(user, id, {
      supplierName: parsed.data.supplierName,
      contactPerson: parsed.data.contactPerson,
      phone: parsed.data.phone,
      email: parsed.data.email,
      address: parsed.data.address,
      gstNumber: parsed.data.gstNumber,
      openingBalance: parsed.data.openingBalance,
    });

    revalidatePath("/suppliers");
    return actionSuccess(undefined);
  } catch (error) {
    if (error instanceof AppError) return actionError(error.message);
    return actionError(getErrorMessage(error));
  }
}

export async function deleteSupplierAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await removeSupplier(user, id);
    revalidatePath("/suppliers");
    return actionSuccess(undefined);
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function restoreSupplierAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await restoreSupplierRecord(user, id);
    revalidatePath("/suppliers");
    return actionSuccess(undefined);
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function getSupplierDetailsAction(id: string) {
  await requireModuleAccess("suppliers");
  return getSupplierDetail(id);
}
