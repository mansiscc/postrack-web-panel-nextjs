import { headers } from "next/headers";

import { logActivity } from "@/lib/activity-log";
import {
  createProductWithOpeningStock,
  getProductBatchesWithStock,
  getProductByBarcode,
  getProductById,
  getProductDetails,
  listProducts,
  restoreProduct,
  softDeleteProduct,
  updateProduct,
  type CreateProductRpcInput,
  type ProductListParams,
  type UpdateProductInput,
} from "@/repositories/products.repository";
import { isReservedProductBarcode } from "@/lib/validation/fields";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/types/auth";
import { AppError } from "@/utils/errors";

export async function getProductsList(params?: ProductListParams) {
  const supabase = await createClient();
  return listProducts(supabase, params);
}

export async function getProductByIdRecord(productId: string) {
  const supabase = await createClient();
  return getProductById(supabase, productId);
}

export async function getProductDetailBundle(productId: string) {
  const supabase = await createClient();
  const [details, batches] = await Promise.all([
    getProductDetails(supabase, productId),
    getProductBatchesWithStock(supabase, productId),
  ]);
  return { details, batches };
}

async function assertUniqueBarcode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  barcode: string | null | undefined,
  excludeId?: string,
) {
  const trimmed = barcode?.trim();
  if (!trimmed) return;

  if (isReservedProductBarcode(trimmed)) {
    throw new AppError(
      "This barcode is reserved for system use",
      "RESERVED_BARCODE",
    );
  }

  const existing = await getProductByBarcode(supabase, trimmed, excludeId);
  if (existing) {
    throw new AppError(
      "A product with this barcode already exists (including deleted products). Restore that product or use a different barcode.",
      "DUPLICATE_BARCODE",
    );
  }
}

export async function createProductRecord(
  user: SessionUser,
  input: CreateProductRpcInput,
) {
  const supabase = await createClient();
  await assertUniqueBarcode(supabase, input.barcode);

  const id = await createProductWithOpeningStock(supabase, {
    ...input,
    createdBy: user.id,
  });

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Create",
    moduleName: "Products",
    description: `Created product "${input.name}"`,
    status: "Success",
    recordId: id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  return id;
}

export async function updateProductRecord(
  user: SessionUser,
  productId: string,
  input: UpdateProductInput,
) {
  const supabase = await createClient();
  const existing = await getProductById(supabase, productId);
  if (!existing) throw new AppError("Product not found", "NOT_FOUND", 404);
  if (existing.is_deleted) {
    throw new AppError("Restore the product before editing", "PRODUCT_DELETED");
  }

  await assertUniqueBarcode(supabase, input.barcode, productId);

  await updateProduct(supabase, productId, {
    ...input,
    stockQuantity: input.stockQuantity ?? existing.stock_quantity,
  });

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Update",
    moduleName: "Products",
    description: `Updated product "${input.name}"`,
    status: "Success",
    recordId: productId,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}

export async function toggleProductActive(
  user: SessionUser,
  productId: string,
  isActive: boolean,
) {
  const supabase = await createClient();
  const existing = await getProductById(supabase, productId);
  if (!existing || existing.is_deleted) {
    throw new AppError("Product not found", "NOT_FOUND", 404);
  }

  await updateProduct(supabase, productId, {
    name: existing.name,
    barcode: existing.barcode,
    purchasePrice: existing.purchase_price,
    sellingPrice: existing.selling_price,
    mrp: existing.mrp,
    unit: existing.unit,
    lowStockAlertQty: existing.low_stock_alert_qty,
    productCategoryId: existing.product_category_id,
    stockQuantity: existing.stock_quantity,
    isActive,
    imageUrl: existing.image_url,
  });

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Update",
    moduleName: "Products",
    description: `${isActive ? "Activated" : "Deactivated"} product "${existing.name}"`,
    status: "Success",
    recordId: productId,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}

export async function removeProduct(user: SessionUser, productId: string) {
  const supabase = await createClient();
  const existing = await getProductById(supabase, productId);
  if (!existing) throw new AppError("Product not found", "NOT_FOUND", 404);

  await softDeleteProduct(supabase, productId);

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Delete",
    moduleName: "Products",
    description: `Deleted product "${existing.name}"`,
    status: "Success",
    recordId: productId,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}

export async function restoreProductRecord(user: SessionUser, productId: string) {
  const supabase = await createClient();
  const existing = await getProductById(supabase, productId);
  if (!existing) throw new AppError("Product not found", "NOT_FOUND", 404);

  await restoreProduct(supabase, productId);

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Update",
    moduleName: "Products",
    description: `Restored product "${existing.name}"`,
    status: "Success",
    recordId: productId,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}
