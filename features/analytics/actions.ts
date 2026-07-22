"use server";

import { format } from "date-fns";

import { requireAdminOrManager } from "@/lib/auth/guards";
import { listBillHistory } from "@/repositories/bills.repository";
import { listStockInEntries } from "@/repositories/stock-in.repository";
import {
  getPurchaseInsights,
  getSalesAnalytics,
} from "@/repositories/analytics.repository";
import { listTransactions } from "@/repositories/transactions.repository";
import { createClient } from "@/lib/supabase/server";
import { actionError, actionSuccess, type ActionResult } from "@/utils/action-result";
import { rowsToCsv } from "@/utils/csv";
import type { DateRangePreset } from "@/utils/date";
import { dateRangePresets } from "@/utils/date";
import { formatDateTime } from "@/utils/date";
import { getErrorMessage } from "@/utils/errors";

type RangeInput = {
  preset?: DateRangePreset;
  from?: string;
  to?: string;
};

function resolveRange(input: RangeInput = {}) {
  if (input.preset === "custom" && input.from && input.to) {
    return {
      from: new Date(`${input.from}T00:00:00`),
      to: new Date(`${input.to}T23:59:59.999`),
      bucket: "day" as const,
    };
  }

  const preset =
    input.preset === "custom" || !input.preset
      ? "today"
      : input.preset === "last7"
        ? "last7"
        : input.preset;
  const { from, to } = dateRangePresets(preset);
  const bucket =
    preset === "month" ? ("month" as const) : preset === "week" ? ("week" as const) : ("day" as const);
  return { from, to, bucket };
}

export async function exportSalesAnalyticsCsvAction(
  range: RangeInput = {},
): Promise<ActionResult<{ filename: string; csv: string }>> {
  try {
    await requireAdminOrManager();
    const supabase = await createClient();
    const { from, to, bucket } = resolveRange(range);
    const summary = await getSalesAnalytics(supabase, {
      start: from.toISOString(),
      end: to.toISOString(),
      bucket,
    });

    const csv = rowsToCsv(
      ["Product", "Net qty", "Revenue", "COGS", "Profit"],
      summary.topProducts.map((product) => [
        product.productName,
        product.netQty,
        product.netRevenue,
        product.cogs,
        product.profit,
      ]),
    );

    return actionSuccess({
      filename: `sales-analytics-${format(new Date(), "yyyy-MM-dd")}.csv`,
      csv,
    });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function exportPurchaseInsightsCsvAction(
  range: RangeInput = {},
): Promise<ActionResult<{ filename: string; csv: string }>> {
  try {
    await requireAdminOrManager();
    const supabase = await createClient();
    const { from, to } = resolveRange(range);
    const summary = await getPurchaseInsights(supabase, { start: from, end: to });

    const supplierCsv = rowsToCsv(
      ["Supplier", "Purchases", "Total spend"],
      summary.topSuppliers.map((supplier) => [
        supplier.supplierName,
        supplier.purchaseCount,
        supplier.totalSpend,
      ]),
    );
    const productCsv = rowsToCsv(
      ["Product", "Qty", "Total spend"],
      summary.topProducts.map((product) => [
        product.productName,
        product.totalQty,
        product.totalSpend,
      ]),
    );

    return actionSuccess({
      filename: `purchase-insights-${format(new Date(), "yyyy-MM-dd")}.csv`,
      csv: `${supplierCsv}\n\n${productCsv}`,
    });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function exportSalesListCsvAction(): Promise<
  ActionResult<{ filename: string; csv: string }>
> {
  try {
    await requireAdminOrManager();
    const supabase = await createClient();
    const { items } = await listBillHistory(supabase, { page: 1, pageSize: 10000 });

    const csv = rowsToCsv(
      [
        "Date",
        "Bill #",
        "Customer",
        "Phone",
        "Amount",
        "Payment",
        "Status",
        "Created by",
      ],
      items.map((item) => [
        formatDateTime(item.created_at),
        item.bill_number,
        item.customer_name,
        item.customer_phone,
        item.total_payable_amount,
        item.payment_mode,
        item.status,
        item.created_by_name,
      ]),
    );

    return actionSuccess({
      filename: `sales-${format(new Date(), "yyyy-MM-dd")}.csv`,
      csv,
    });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function exportPurchasesListCsvAction(): Promise<
  ActionResult<{ filename: string; csv: string }>
> {
  try {
    await requireAdminOrManager();
    const supabase = await createClient();
    const { items } = await listStockInEntries(supabase, {
      page: 1,
      pageSize: 10000,
    });

    const csv = rowsToCsv(
      [
        "Date",
        "Invoice",
        "Supplier",
        "Items",
        "Amount",
        "Notes",
        "Created by",
      ],
      items.map((item) => [
        item.date,
        item.invoice_number,
        item.supplier_name,
        item.total_items,
        item.total_amount,
        item.notes,
        item.created_by_name,
      ]),
    );

    return actionSuccess({
      filename: `purchases-${format(new Date(), "yyyy-MM-dd")}.csv`,
      csv,
    });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}

export async function exportTransactionsListCsvAction(): Promise<
  ActionResult<{ filename: string; csv: string }>
> {
  try {
    await requireAdminOrManager();
    const supabase = await createClient();
    const items = await listTransactions(supabase);

    const csv = rowsToCsv(
      ["Date", "Type", "Account", "Category", "Amount", "Source", "Remarks"],
      items.map((item) => [
        item.entry_date,
        item.entry_type,
        item.account_name,
        item.category_name,
        item.amount,
        item.source_type ?? "system",
        item.remarks,
      ]),
    );

    return actionSuccess({
      filename: `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`,
      csv,
    });
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}
