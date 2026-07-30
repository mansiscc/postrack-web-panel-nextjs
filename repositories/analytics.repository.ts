import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { mapSupabaseError } from "@/utils/errors";

export type SalesAnalyticsSummary = {
  billCount: number;
  totalSales: number;
  totalReceived: number;
  cashTotal: number;
  upiTotal: number;
  cardTotal: number;
  returnCount: number;
  returnAmount: number;
  netSales: number;
  cogs: number;
  salesProfit: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    netQty: number;
    netRevenue: number;
    cogs: number;
    profit: number;
  }>;
  trend: Array<{ label: string; sales: number }>;
};

export type PurchaseInsightsSummary = {
  purchaseCount: number;
  totalSpend: number;
  totalItems: number;
  topSuppliers: Array<{
    supplierId: string | null;
    supplierName: string;
    purchaseCount: number;
    totalSpend: number;
  }>;
  recentPurchases: Array<{
    id: string;
    date: string;
    supplierName: string;
    invoiceNumber: string | null;
    totalAmount: number;
    totalItems: number;
  }>;
  topProducts: Array<{
    productId: string;
    productName: string;
    totalQty: number;
    totalSpend: number;
  }>;
  trend: Array<{ label: string; spend: number }>;
};

function mapSalesAnalyticsPayload(payload: unknown): SalesAnalyticsSummary {
  const data = (payload ?? {}) as Record<string, unknown>;
  const topProducts = Array.isArray(data.top_products)
    ? data.top_products.map((item) => {
        const row = item as Record<string, unknown>;
        return {
          productId: String(row.product_id ?? ""),
          productName: String(row.product_name ?? "Unknown"),
          netQty: Number(row.net_qty ?? 0),
          netRevenue: Number(row.net_revenue ?? 0),
          cogs: Number(row.cogs ?? 0),
          profit: Number(row.profit ?? 0),
        };
      })
    : [];
  const trend = Array.isArray(data.trend)
    ? data.trend.map((item) => {
        const row = item as Record<string, unknown>;
        return {
          label: String(row.label ?? ""),
          sales: Number(row.sales ?? 0),
        };
      })
    : [];

  const totalSales = Number(data.total_sales ?? 0);
  const cogs = Number(data.cogs ?? 0);
  const salesProfit = Number(data.sales_profit ?? 0);

  return {
    billCount: Number(data.bill_count ?? 0),
    totalSales,
    totalReceived: Number(data.total_received ?? 0),
    cashTotal: Number(data.cash_total ?? 0),
    upiTotal: Number(data.upi_total ?? 0),
    cardTotal: Number(data.card_total ?? 0),
    returnCount: Number(data.return_count ?? 0),
    returnAmount: Number(data.return_amount ?? 0),
    netSales: Number(data.net_sales ?? 0),
    cogs,
    salesProfit,
    topProducts,
    trend,
  };
}

export async function getSalesAnalytics(
  supabase: SupabaseClient<Database>,
  params: { start: string; end: string; bucket?: "day" | "week" | "month" },
): Promise<SalesAnalyticsSummary> {
  const { data, error } = await supabase.rpc("get_sales_analytics_summary", {
    p_start: params.start,
    p_end: params.end,
    p_bucket: params.bucket ?? "day",
  });

  if (error) throw mapSupabaseError(error);
  return mapSalesAnalyticsPayload(data);
}

export async function getPurchaseInsights(
  supabase: SupabaseClient<Database>,
  params: { start: Date; end: Date },
): Promise<PurchaseInsightsSummary> {
  const startDate = format(params.start, "yyyy-MM-dd");
  const endDate = format(params.end, "yyyy-MM-dd");

  const { data: purchases, error } = await supabase
    .from("stock_in")
    .select("id, date, total_amount, total_items, supplier_id, invoice_number")
    .gte("date", startDate)
    .lte("date", endDate)
    .neq("invoice_number", "OPENING");

  if (error) throw mapSupabaseError(error);
  if (!purchases?.length) {
    return {
      purchaseCount: 0,
      totalSpend: 0,
      totalItems: 0,
      topSuppliers: [],
      recentPurchases: [],
      topProducts: [],
      trend: [],
    };
  }

  const purchaseIds = purchases.map((purchase) => purchase.id);
  const supplierIds = [
    ...new Set(
      purchases
        .map((purchase) => purchase.supplier_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [{ data: suppliers }, { data: items }] = await Promise.all([
    supplierIds.length
      ? supabase.from("suppliers").select("id, supplier_name").in("id", supplierIds)
      : Promise.resolve({ data: [] as Array<{ id: string; supplier_name: string }> }),
    supabase
      .from("stock_in_items")
      .select("product_id, quantity, row_total, stock_in_id")
      .in("stock_in_id", purchaseIds),
  ]);

  const supplierMap = new Map(
    (suppliers ?? []).map((supplier) => [supplier.id, supplier.supplier_name]),
  );

  const productIds = [
    ...new Set((items ?? []).map((item) => item.product_id)),
  ];
  const { data: products } = productIds.length
    ? await supabase.from("products").select("id, name").in("id", productIds)
    : { data: [] as Array<{ id: string; name: string }> };

  const productMap = new Map(
    (products ?? []).map((product) => [product.id, product.name]),
  );

  const supplierTotals = new Map<
    string,
    { supplierId: string | null; supplierName: string; purchaseCount: number; totalSpend: number }
  >();
  const trendMap = new Map<string, number>();
  let totalSpend = 0;
  let totalItems = 0;

  for (const purchase of purchases) {
    totalSpend += purchase.total_amount ?? 0;
    totalItems += purchase.total_items ?? 0;

    const supplierKey = purchase.supplier_id ?? "walk-in";
    const supplierName = purchase.supplier_id
      ? (supplierMap.get(purchase.supplier_id) ?? "Unknown supplier")
      : "Walk-in purchase";
    const existing = supplierTotals.get(supplierKey) ?? {
      supplierId: purchase.supplier_id,
      supplierName,
      purchaseCount: 0,
      totalSpend: 0,
    };
    existing.purchaseCount += 1;
    existing.totalSpend += purchase.total_amount ?? 0;
    supplierTotals.set(supplierKey, existing);

    const label = purchase.date;
    trendMap.set(label, (trendMap.get(label) ?? 0) + (purchase.total_amount ?? 0));
  }

  const productTotals = new Map<
    string,
    { productId: string; productName: string; totalQty: number; totalSpend: number }
  >();

  for (const item of items ?? []) {
    const productName = productMap.get(item.product_id) ?? "Unknown product";
    const existing = productTotals.get(item.product_id) ?? {
      productId: item.product_id,
      productName,
      totalQty: 0,
      totalSpend: 0,
    };
    existing.totalQty += item.quantity ?? 0;
    existing.totalSpend += item.row_total ?? 0;
    productTotals.set(item.product_id, existing);
  }

  return {
    purchaseCount: purchases.length,
    totalSpend,
    totalItems,
    topSuppliers: [...supplierTotals.values()]
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 5),
    recentPurchases: [...purchases]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10)
      .map((purchase) => ({
        id: purchase.id,
        date: purchase.date,
        supplierName: purchase.supplier_id
          ? (supplierMap.get(purchase.supplier_id) ?? "Unknown supplier")
          : "Walk-in purchase",
        invoiceNumber:
          purchase.invoice_number && purchase.invoice_number !== "OPENING"
            ? purchase.invoice_number
            : null,
        totalAmount: purchase.total_amount ?? 0,
        totalItems: purchase.total_items ?? 0,
      })),
    topProducts: [...productTotals.values()]
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 10),
    trend: [...trendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, spend]) => ({ label, spend })),
  };
}
