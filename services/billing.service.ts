import { headers } from "next/headers";

import { logActivity } from "@/lib/activity-log";
import {
  createBill,
  createBillEntry,
  createBillItems,
  existsEntryForSource,
  getBillById,
  getBillItems,
  getManualBillProductId,
  getReturnedQuantitiesByBillItem,
  getSalesCategoryId,
  getTotalRefundedForBillReturnIds,
  listBillHistory,
  listBillReturnItems,
  listBillReturns,
  searchBillingProducts,
  updateBillPayment,
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
  calculateRemainingDue,
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
  accountId?: string;
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
  const [bill, items, returnedMap, returns] = await Promise.all([
    getBillById(supabase, billId),
    getBillItems(supabase, billId),
    getReturnedQuantitiesByBillItem(supabase, billId),
    listBillReturns(supabase, billId),
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

  const returnItems = await listBillReturnItems(
    supabase,
    returns.map((row) => row.id),
  );
  const returnItemsByReturnId = new Map<string, typeof returnItems>();
  for (const item of returnItems) {
    const list = returnItemsByReturnId.get(item.return_id) ?? [];
    list.push(item);
    returnItemsByReturnId.set(item.return_id, list);
  }

  const returnsWithItems = returns.map((row) => ({
    ...row,
    items: returnItemsByReturnId.get(row.id) ?? [],
  }));

  const totalReturnedAmount = Number(
    returns
      .reduce((sum, row) => sum + (row.total_return_amount ?? 0), 0)
      .toFixed(2),
  );
  const alreadyRefunded = await getTotalRefundedForBillReturnIds(
    supabase,
    returns.map((row) => row.id),
  );
  const remainingDue = calculateRemainingDue({
    totalPayable: bill.total_payable_amount,
    totalReturnedAmount,
    receivedAmount: bill.received_amount_total,
  });

  return {
    bill,
    items: itemsWithReturnable,
    customerName,
    customerPhone,
    returns: returnsWithItems,
    totalReturnedAmount,
    alreadyRefunded,
    remainingDue,
  };
}

export async function completeBillPayment(
  user: SessionUser,
  input: { billId: string; accountId?: string | null },
) {
  const supabase = await createClient();
  const [bill, returns, defaultAccount, accounts] = await Promise.all([
    getBillById(supabase, input.billId),
    listBillReturns(supabase, input.billId),
    getDefaultAccount(supabase),
    listActiveAccounts(supabase),
  ]);

  if (!bill) {
    throw new AppError("Bill not found", "NOT_FOUND", 404);
  }

  const totalReturnedAmount = Number(
    returns
      .reduce((sum, row) => sum + (row.total_return_amount ?? 0), 0)
      .toFixed(2),
  );
  const remainingDue = calculateRemainingDue({
    totalPayable: bill.total_payable_amount,
    totalReturnedAmount,
    receivedAmount: bill.received_amount_total,
  });

  if (remainingDue <= 0) {
    throw new AppError("No remaining balance to collect", "VALIDATION_ERROR");
  }

  const accountId =
    input.accountId ||
    defaultAccount?.id ||
    accounts[0]?.id ||
    null;

  if (!accountId) {
    throw new AppError("Payment account is required", "VALIDATION_ERROR");
  }

  const newReceived = Number(
    (bill.received_amount_total + remainingDue).toFixed(2),
  );
  const newCash = Number((bill.cash_amount + remainingDue).toFixed(2));

  await updateBillPayment(supabase, bill.id, {
    status: "PAID",
    receivedAmountTotal: newReceived,
    cashAmount: newCash,
    onlineAmount: bill.online_amount,
  });

  const alreadyPosted = await existsEntryForSource(
    supabase,
    "bill_payment",
    bill.id,
    accountId,
  );

  if (!alreadyPosted) {
    const categoryId = await getSalesCategoryId(supabase, user.companyId, {
      ensure: true,
      userId: user.id,
    });
    if (!categoryId) {
      throw new AppError("Sales accounting category not found", "NOT_FOUND");
    }

    const billLabel = bill.bill_number?.trim();
    await createBillEntry(supabase, {
      company_id: user.companyId,
      entry_type: "income",
      account_id: accountId,
      category_id: categoryId,
      amount: remainingDue,
      entry_date: new Date().toISOString().slice(0, 10),
      remarks: billLabel
        ? `Due payment collected for Bill #${billLabel}`
        : "Due payment collection",
      source_type: "bill_payment",
      source_id: bill.id,
      payment_mode: bill.payment_mode,
      created_by: user.id,
    });
  }

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Update",
    moduleName: "Billing",
    description: `Collected due payment for bill ${bill.bill_number ?? bill.id}`,
    status: "Success",
    recordId: bill.id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  return { collectedAmount: remainingDue };
}

export async function saveBill(user: SessionUser, input: SaveBillInput) {
  if (!input.items.length && (input.otherItemsAmount ?? 0) <= 0) {
    throw new AppError(
      "Add cart items or an other-items amount",
      "VALIDATION_ERROR",
    );
  }

  if (input.receivedAmount > 0 && !input.accountId) {
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

  const hasManual = input.items.some((item) => item.isManual);
  const manualProductId = hasManual
    ? await getManualBillProductId(supabase)
    : null;

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

  if (input.items.length) {
    await createBillItems(
      supabase,
      input.items.map((item) => ({
        company_id: user.companyId,
        bill_id: bill.id,
        product_id: item.isManual ? manualProductId! : item.productId,
        product_name: item.productName,
        barcode: item.barcode ?? null,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        row_total: Number((item.unitPrice * item.quantity).toFixed(2)),
        batch_id: item.batchId ?? null,
      })),
    );
  }

  if (totals.receivedAmount > 0) {
    const categoryId = await getSalesCategoryId(supabase, user.companyId, {
      ensure: true,
      userId: user.id,
    });
    if (!categoryId) {
      throw new AppError("Sales accounting category not found", "NOT_FOUND");
    }

    await createBillEntry(supabase, {
      company_id: user.companyId,
      entry_type: "income",
      account_id: input.accountId!,
      category_id: categoryId,
      amount: totals.receivedAmount,
      entry_date: new Date().toISOString().slice(0, 10),
      remarks: `Bill ${bill.bill_number ?? bill.id}`,
      source_type: "bill",
      source_id: bill.id,
      payment_mode: input.paymentMode,
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
