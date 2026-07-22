import { headers } from "next/headers";

import { logActivity } from "@/lib/activity-log";
import { listActiveAccountingCategoriesByType } from "@/repositories/accounting-categories.repository";
import { listActiveAccounts } from "@/repositories/accounts.repository";
import {
  createManualEntry,
  getTransactionById,
  getTransactionsTotals,
  listTransactions,
  softDeleteEntry,
  updateManualEntry,
} from "@/repositories/transactions.repository";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/types/auth";
import { AppError } from "@/utils/errors";

type ManualEntryInput = {
  entryType: "income" | "expense";
  accountId: string;
  categoryId: string;
  amount: number;
  entryDate: string;
  remarks?: string | null;
  paymentMode?: "Cash" | "UPI" | "Card" | "Mixed" | null;
};

export async function getTransactionsList(params?: {
  search?: string;
  entryType?: "all" | "income" | "expense";
  accountId?: string;
  categoryId?: string;
  sourceType?: "all" | "manual" | "system";
  dateFrom?: string;
  dateTo?: string;
}) {
  const supabase = await createClient();
  return listTransactions(supabase, params);
}

export async function getTransactionTotalsSummary() {
  const supabase = await createClient();
  return getTransactionsTotals(supabase);
}

export async function getTransactionFormOptions() {
  const supabase = await createClient();
  const [accounts, incomeCategories, expenseCategories] = await Promise.all([
    listActiveAccounts(supabase),
    listActiveAccountingCategoriesByType(supabase, "income"),
    listActiveAccountingCategoriesByType(supabase, "expense"),
  ]);

  return { accounts, incomeCategories, expenseCategories };
}

export async function createManualTransaction(
  user: SessionUser,
  input: ManualEntryInput,
) {
  const supabase = await createClient();
  const id = await createManualEntry(supabase, {
    company_id: user.companyId,
    entry_type: input.entryType,
    account_id: input.accountId,
    category_id: input.categoryId,
    amount: input.amount,
    entry_date: input.entryDate,
    remarks: input.remarks?.trim() || null,
    source_type: "manual",
    source_id: null,
    payment_mode: input.paymentMode ?? null,
    created_by: user.id,
  });

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Create",
    moduleName: "Transactions",
    description: `Created manual ${input.entryType} entry of ${input.amount}`,
    status: "Success",
    recordId: id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  return id;
}

export async function updateManualTransaction(
  user: SessionUser,
  id: string,
  input: ManualEntryInput,
) {
  const supabase = await createClient();
  const existing = await getTransactionById(supabase, id);
  if (!existing) {
    throw new AppError("Transaction not found", "NOT_FOUND", 404);
  }
  if (existing.source_type !== "manual") {
    throw new AppError("Only manual entries can be edited.", "FORBIDDEN", 403);
  }

  await updateManualEntry(supabase, id, {
    entry_type: input.entryType,
    account_id: input.accountId,
    category_id: input.categoryId,
    amount: input.amount,
    entry_date: input.entryDate,
    remarks: input.remarks?.trim() || null,
    payment_mode: input.paymentMode ?? null,
  });

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Update",
    moduleName: "Transactions",
    description: `Updated manual ${input.entryType} entry`,
    status: "Success",
    recordId: id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}

export async function removeManualTransaction(user: SessionUser, id: string) {
  const supabase = await createClient();
  const existing = await getTransactionById(supabase, id);
  if (!existing) {
    throw new AppError("Transaction not found", "NOT_FOUND", 404);
  }
  if (existing.source_type !== "manual") {
    throw new AppError("Only manual entries can be deleted.", "FORBIDDEN", 403);
  }

  await softDeleteEntry(supabase, id);

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Delete",
    moduleName: "Transactions",
    description: `Deleted manual ${existing.entry_type} entry`,
    status: "Success",
    recordId: id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}
