import { headers } from "next/headers";

import { logActivity } from "@/lib/activity-log";
import {
  createBill,
  createBillEntry,
  createBillItems,
  getBillById,
  getBillItems,
  getManualBillProductId,
  getReturnedQuantitiesByBillItem,
  getSalesCategoryId,
  listBillHistory,
  searchBillingProducts,
  type BillListParams,
} from "@/repositories/bills.repository";
import { getProductBatchesWithStock } from "@/repositories/products.repository";
import { listCustomers } from "@/repositories/customers.repository";
import { getDefaultAccount, listActiveAccounts } from "@/repositories/accounts.repository";
import { resolveBillingCustomer } from "@/services/customer.service";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/types/auth";
import {
  calculateBillingTotals,
  splitPaymentAmounts,
  type DiscountType,
} from "@/utils/billing-calculator";
import { AppError } from "@/utils/errors";

export type SaveBillLineItem = {
  productId: string;
  productName: string;
  barcode?: string | null;
  unitPrice: number;
  quantity: number;
  batchId?: string | null;
  isManual?: boolean;
};

export type SaveBillInput = {
  items: SaveBillLineItem[];
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  otherItemsAmount?: number;
  discountType?: DiscountType | null;
  discountValue?: number;
  paymentMode: "Cash" | "UPI" | "Card" | "Mixed";
  mixedCashAmount?: number;
  mixedUpiAmount?: number;
  receivedAmount: number;
  accountId: string;
};

export async function getBillingFormOptions() {
  const supabase = await createClient();
  const [products, customers, accounts, defaultAccount] = await Promise.all([
    searchBillingProducts(supabase),
    listCustomers(supabase),
    listActiveAccounts(supabase),
    getDefaultAccount(supabase),
  ]);

  return {
    products,
    customers,
    accounts,
    defaultAccountId: defaultAccount?.id ?? accounts[0]?.id ?? null,
  };
}

export async function getBillingCatalog(query?: string) {
  const supabase = await createClient();
  return searchBillingProducts(supabase, query);
}

export async function getBillingProductBatches(productId: string) {
  const supabase = await createClient();
  return getProductBatchesWithStock(supabase, productId);
}

export async function getSalesHistory(params?: BillListParams) {
  const supabase = await createClient();
  return listBillHistory(supabase, params);
}

export async function getBillDetail(billId: string) {
  const supabase = await createClient();
  const [bill, items, returnedMap] = await Promise.all([
    getBillById(supabase, billId),
    getBillItems(supabase, billId),
    getReturnedQuantitiesByBillItem(supabase, billId),
  ]);

  if (!bill) return null;

  let customerName = "Walk-in";
  let customerPhone = "";
  if (bill.customer_id) {
    const { data } = await supabase
      .from("customers")
      .select("name, phone")
      .eq("id", bill.customer_id)
      .maybeSingle();
    customerName = data?.name ?? customerName;
    customerPhone = data?.phone ?? "";
  }

  const itemsWithReturnable = items.map((item) => {
    const returnedQty = returnedMap.get(item.id) ?? 0;
    return {
      ...item,
      returnedQty,
      returnableQty: Math.max(item.quantity - returnedQty, 0),
    };
  });

  return { bill, items: itemsWithReturnable, customerName, customerPhone };
}

export async function saveBill(user: SessionUser, input: SaveBillInput) {
  if (!input.items.length) {
    throw new AppError("Cart is empty", "VALIDATION_ERROR");
  }

  if (!input.accountId) {
    throw new AppError("Payment account is required", "VALIDATION_ERROR");
  }

  const totals = calculateBillingTotals({
    items: input.items.map((item) => ({
      unitPrice: item.unitPrice,
      quantity: item.quantity,
    })),
    otherItemsAmount: input.otherItemsAmount,
    discountType: input.discountType,
    discountValue: input.discountValue,
    receivedAmount: input.receivedAmount,
  });

  const { cashAmount, onlineAmount } = splitPaymentAmounts(
    input.paymentMode,
    totals.receivedAmount,
    input.mixedCashAmount,
    input.mixedUpiAmount,
  );

  if (
    input.paymentMode === "Mixed" &&
    Math.abs(cashAmount + onlineAmount - totals.receivedAmount) > 0.01
  ) {
    throw new AppError(
      "Cash and UPI amounts must equal received amount",
      "VALIDATION_ERROR",
    );
  }

  const supabase = await createClient();
  const customerId = await resolveBillingCustomer(user, {
    customerId: input.customerId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
  });

  const manualProductId = await getManualBillProductId(supabase);

  const bill = await createBill(supabase, {
    company_id: user.companyId,
    customer_id: customerId,
    subtotal_amount: totals.subtotal,
    other_items_amount: totals.otherItemsAmount,
    discount_type: input.discountType ?? null,
    discount_value: input.discountValue ?? null,
    discount_amount: totals.discountAmount,
    total_payable_amount: totals.totalPayable,
    payment_mode: input.paymentMode,
    cash_amount: cashAmount,
    online_amount: onlineAmount,
    received_amount_total: totals.receivedAmount,
    status: totals.status,
    created_by_user_id: user.id,
  });

  await createBillItems(
    supabase,
    input.items.map((item) => ({
      company_id: user.companyId,
      bill_id: bill.id,
      product_id: item.isManual ? manualProductId : item.productId,
      product_name: item.productName,
      barcode: item.barcode ?? null,
      unit_price: item.unitPrice,
      quantity: item.quantity,
      row_total: Number((item.unitPrice * item.quantity).toFixed(2)),
      batch_id: item.batchId ?? null,
    })),
  );

  if (totals.receivedAmount > 0) {
    const categoryId = await getSalesCategoryId(supabase, user.companyId);
    if (!categoryId) {
      throw new AppError("Sales accounting category not found", "NOT_FOUND");
    }

    await createBillEntry(supabase, {
      company_id: user.companyId,
      entry_type: "income",
      account_id: input.accountId,
      category_id: categoryId,
      amount: totals.receivedAmount,
      entry_date: new Date().toISOString().slice(0, 10),
      remarks: `Bill ${bill.bill_number ?? bill.id}`,
      source_type: "bill",
      source_id: bill.id,
      created_by: user.id,
    });
  }

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Create",
    moduleName: "Billing",
    description: `Created bill ${bill.bill_number ?? bill.id}`,
    status: "Success",
    recordId: bill.id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  return bill;
}
