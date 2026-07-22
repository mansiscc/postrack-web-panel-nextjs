import { headers } from "next/headers";

import { logActivity } from "@/lib/activity-log";
import { getDefaultAccount, listActiveAccounts } from "@/repositories/accounts.repository";
import { listProducts } from "@/repositories/products.repository";
import {
  createStockIn,
  getStockInHeader,
  getStockInItems,
  listStockInEntries,
  type CreateStockInLineItem,
  type StockInListParams,
} from "@/repositories/stock-in.repository";
import { listSuppliers } from "@/repositories/suppliers.repository";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/types/auth";
import { AppError } from "@/utils/errors";

export type CreatePurchaseInput = {
  date: string;
  supplierId?: string | null;
  invoiceNumber?: string | null;
  notes?: string | null;
  accountId?: string | null;
  items: CreateStockInLineItem[];
};

export async function getPurchasesList(params?: StockInListParams) {
  const supabase = await createClient();
  return listStockInEntries(supabase, params);
}

export async function getPurchaseDetail(purchaseId: string) {
  const supabase = await createClient();
  const [header, items] = await Promise.all([
    getStockInHeader(supabase, purchaseId),
    getStockInItems(supabase, purchaseId),
  ]);

  if (!header) return null;

  let supplierName = "Walk-in Purchase";
  if (header.invoice_number === "OPENING") {
    supplierName = "Opening Stock";
  } else if (header.supplier_id) {
    const { data } = await supabase
      .from("suppliers")
      .select("supplier_name")
      .eq("id", header.supplier_id)
      .maybeSingle();
    supplierName = data?.supplier_name ?? supplierName;
  }

  let accountName: string | null = null;
  const { data: account } = await supabase
    .from("accounts")
    .select("name")
    .eq("id", header.account_id)
    .maybeSingle();
  accountName = account?.name ?? null;

  return { header, items, supplierName, accountName };
}

export async function getPurchaseFormOptions() {
  const supabase = await createClient();
  const [suppliers, products, accounts, defaultAccount] = await Promise.all([
    listSuppliers(supabase),
    listProducts(supabase, { status: "active" }),
    listActiveAccounts(supabase),
    getDefaultAccount(supabase),
  ]);

  return {
    suppliers,
    products: products.filter((p) => p.is_active && !p.is_deleted),
    accounts,
    defaultAccountId: defaultAccount?.id ?? accounts[0]?.id ?? null,
  };
}

export async function createPurchaseRecord(
  user: SessionUser,
  input: CreatePurchaseInput,
) {
  if (!input.items.length) {
    throw new AppError("Add at least one line item", "VALIDATION_ERROR");
  }

  const supabase = await createClient();
  const id = await createStockIn(supabase, {
    date: input.date,
    items: input.items,
    supplierId: input.supplierId,
    invoiceNumber: input.invoiceNumber,
    notes: input.notes,
    accountId: input.accountId,
    createdBy: user.id,
  });

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Create",
    moduleName: "Purchases",
    description: `Created purchase (${input.invoiceNumber || id})`,
    status: "Success",
    recordId: id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  return id;
}
