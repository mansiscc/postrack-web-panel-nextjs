"use server";

import { revalidatePath } from "next/cache";

import {
  createProductSchema,
  updateProductSchema,
} from "@/hooks/features/products/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { generateProductBarcode } from "@/lib/validation/constants";
import { requireModuleAccess } from "@/lib/auth/session";
import {
  createProductRecord,
  getProductDetailBundle,
  removeProduct,
  restoreProductRecord,
  toggleProductActive,
  updateProductRecord,
} from "@/services/product.service";
import { actionError, actionSuccess, type ActionResult } from "@/utils/action-result";
import { AppError, getErrorMessage } from "@/utils/errors";

export async function createProductAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireModuleAccess("products");
    const parsed = createProductSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const id = await createProductRecord(user, {
      name: parsed.data.name,
      barcode: parsed.data.barcode ?? generateProductBarcode(),
      purchasePrice: parsed.data.purchasePrice,
      sellingPrice: parsed.data.sellingPrice,
      mrp: parsed.data.mrp,
      unit: parsed.data.unit,
      lowStockAlertQty: parsed.data.lowStockAlertQty,
      productCategoryId: parsed.data.productCategoryId,
      openingStock: parsed.data.openingStock,
      isActive: parsed.data.isActive,
      imageUrl: parsed.data.imageUrl,
    });

    revalidatePath("/products");
    return actionSuccess({ id });
  } catch (error) {
    if (error instanceof AppError) return actionError(error.message);
    return actionError(getErrorMessage(error));
  }
}

export async function updateProductAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireModuleAccess("products");
    const parsed = updateProductSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    await updateProductRecord(user, id, {
      name: parsed.data.name,
      barcode: parsed.data.barcode,
      purchasePrice: parsed.data.purchasePrice,
      sellingPrice: parsed.data.sellingPrice,
      mrp: parsed.data.mrp,
      unit: parsed.data.unit,
      lowStockAlertQty: parsed.data.lowStockAlertQty,
      productCategoryId: parsed.data.productCategoryId,
      stockQuantity: parsed.data.stockQuantity,
      isActive: parsed.data.isActive,
      imageUrl: parsed.data.imageUrl,
    });

    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return actionSuccess(undefined);
  } catch (error) {
    if (error instanceof AppError) return actionError(error.message);
    return actionError(getErrorMessage(error));
  }
}

export async function toggleProductActiveAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    const user = await requireModuleAccess("products");
    await toggleProductActive(user, id, isActive);
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return actionSuccess(undefined);
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await removeProduct(user, id);
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return actionSuccess(undefined);
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function restoreProductAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    await restoreProductRecord(user, id);
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return actionSuccess(undefined);
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function getProductDetailsAction(id: string) {
  await requireModuleAccess("products");
  return getProductDetailBundle(id);
}
