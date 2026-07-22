import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { mapSupabaseError } from "@/utils/errors";

export type DashboardTotalsRow = {
  todaySales: number;
  todayManualIncome: number;
  todayPurchase: number;
  todayManualExpense: number;
  todayProfit: number;
  billCount: number;
  todayReturnsCount: number;
  todayReturnAmount: number;
  cashTotal: number;
  upiTotal: number;
  cardTotal: number;
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  inactiveProductCount: number;
  outOfStockProducts: Array<{ name: string; stock_quantity: number }>;
  todaySalesRevenue: number;
  todayCogs: number;
  todaySalesProfit: number;
  todaySalesProfitMargin: number;
};

export async function getDashboardTotals(
  supabase: SupabaseClient<Database>,
  params: { start: string; end: string; today: string },
): Promise<DashboardTotalsRow> {
  const { data, error } = await supabase.rpc("get_admin_dashboard_totals", {
    p_start: params.start,
    p_end: params.end,
    p_today: params.today,
  });

  if (error) throw mapSupabaseError(error);

  const row = data?.[0];
  const outOfStockRaw = row?.out_of_stock_products;
  const outOfStockProducts = Array.isArray(outOfStockRaw)
    ? (outOfStockRaw as Array<{ name: string; stock_quantity: number }>)
    : [];

  return {
    todaySales: row?.today_sales ?? 0,
    todayManualIncome: row?.today_manual_income ?? 0,
    todayPurchase: row?.today_purchase ?? 0,
    todayManualExpense: row?.today_manual_expense ?? 0,
    todayProfit: row?.today_profit ?? 0,
    billCount: row?.bill_count ?? 0,
    todayReturnsCount: row?.today_returns_count ?? 0,
    todayReturnAmount: row?.today_return_amount ?? 0,
    cashTotal: row?.cash_total ?? 0,
    upiTotal: row?.upi_total ?? 0,
    cardTotal: row?.card_total ?? 0,
    totalProducts: row?.total_products ?? 0,
    lowStockCount: row?.low_stock_count ?? 0,
    outOfStockCount: row?.out_of_stock_count ?? 0,
    inactiveProductCount: row?.inactive_product_count ?? 0,
    outOfStockProducts,
    todaySalesRevenue: row?.today_sales_revenue ?? 0,
    todayCogs: row?.today_cogs ?? 0,
    todaySalesProfit: row?.today_sales_profit ?? 0,
    todaySalesProfitMargin: row?.today_sales_profit_margin ?? 0,
  };
}
