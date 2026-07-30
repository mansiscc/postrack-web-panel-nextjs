"use client";

import {
  BarChart3,
  Package,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { DateRangeToolbar } from "@/hooks/features/analytics/components/date-range-toolbar";
import { PaymentBreakdown } from "@/hooks/features/analytics/components/payment-breakdown";
import { exportSalesAnalyticsCsvAction } from "@/hooks/features/analytics/actions";
import type { SalesAnalyticsSummary } from "@/repositories/analytics.repository";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/utils/currency";
import { downloadCsv } from "@/utils/csv";
import type { DateRangePreset } from "@/utils/date";

type SalesAnalyticsPanelProps = {
  summary: SalesAnalyticsSummary;
  rangeLabel: string;
};

function SectionCard({
  title,
  icon: Icon,
  accent,
  badgeBg,
  children,
  className,
}: {
  title: string;
  icon: React.ElementType;
  accent: string;
  badgeBg: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-lg bg-card shadow-card",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-border/40 px-3.5 py-3">
        <span
          className={cn(
            "flex items-center justify-center rounded-md p-1.5",
            badgeBg,
          )}
        >
          <Icon className={cn("size-4", accent)} strokeWidth={2} />
        </span>
        <span className="flex-1 text-[13px] font-bold text-foreground">
          {title}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-3">{children}</div>
    </div>
  );
}

function SummaryKpiCard({
  icon: Icon,
  label,
  value,
  iconWrapClass,
  iconClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  iconWrapClass: string;
  iconClass: string;
}) {
  return (
    <div className="flex min-h-24 items-center gap-3.5 rounded-lg bg-card px-4 py-4 shadow-card">
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-md",
          iconWrapClass,
        )}
      >
        <Icon className={cn("size-5", iconClass)} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-[18px] font-bold tabular-nums text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

function formatTrendLabel(label: string): string {
  // ISO day: 2026-07-30 → 30
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    return String(Number(label.slice(8)));
  }
  // ISO month fallback: 2026-07 → 1 (first of month) — prefer day buckets upstream
  if (/^\d{4}-\d{2}$/.test(label)) {
    return "1";
  }
  // ISO week: 2026-W30 → W30
  if (/^\d{4}-W\d{2}$/i.test(label)) {
    return label.slice(5);
  }
  return label;
}

function VerticalTrendChart({
  points,
}: {
  points: Array<{ label: string; value: number }>;
}) {
  const hasTrend = points.some((point) => point.value > 0);
  if (!points.length || !hasTrend) {
    return (
      <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted-foreground">
        No sales trend data for this period
      </p>
    );
  }

  const max = Math.max(...points.map((point) => Math.abs(point.value)), 1);
  const showLabels = points.length <= 31;
  const barAreaHeight = 160;

  return (
    <div className="overflow-x-auto">
      <div
        className="flex min-w-full items-end gap-1 px-1"
        style={{
          minWidth: `${Math.max(points.length * 22, 100)}px`,
          height: barAreaHeight + (showLabels ? 18 : 0),
        }}
      >
        {points.map((point) => {
          const fraction = Math.abs(point.value) / max;
          const barHeight = Math.max(
            fraction * barAreaHeight,
            point.value > 0 ? 4 : 2,
          );
          return (
            <div
              key={point.label}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
              title={`${point.label}: ${formatCurrency(point.value)}`}
            >
              <div
                className={cn(
                  "w-[70%] max-w-6 rounded-t-sm transition-all",
                  point.value > 0 ? "bg-primary/70" : "bg-border/60",
                )}
                style={{
                  height: barHeight,
                  opacity: point.value > 0 ? 0.55 + fraction * 0.45 : 0.35,
                }}
              />
              {showLabels ? (
                <span className="h-3.5 max-w-full truncate text-[10px] leading-none text-muted-foreground">
                  {formatTrendLabel(point.label)}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function rankBadgeClass(rank: number) {
  if (rank === 1) return "bg-rank-1 text-foreground";
  if (rank === 2) return "bg-rank-2 text-rank-2-foreground";
  if (rank === 3) return "bg-rank-3 text-primary";
  return "bg-muted text-muted-foreground";
}

export function SalesAnalyticsPanel({
  summary,
}: SalesAnalyticsPanelProps) {
  const searchParams = useSearchParams();
  const preset = (searchParams.get("preset") as DateRangePreset) || "today";

  const itemsSold = summary.topProducts.reduce(
    (sum, item) => sum + item.netQty,
    0,
  );
  const itemRevenue = summary.salesProfit + summary.cogs;
  const avgBill =
    summary.billCount > 0 ? summary.totalSales / summary.billCount : 0;
  const profitMargin =
    itemRevenue > 0 ? (summary.salesProfit / itemRevenue) * 100 : 0;
  const hasProfitData =
    itemRevenue > 0 || summary.cogs > 0 || summary.returnAmount > 0;
  const profitPositive = summary.salesProfit > 0;
  const profitNegative = summary.salesProfit < 0;

  const trendTitle =
    preset === "today" ||
    preset === "week" ||
    preset === "month" ||
    preset === "last7"
      ? "Sales Trend (Daily)"
      : "Sales Trend";

  const handleExport = async () => {
    const result = await exportSalesAnalyticsCsvAction({
      preset,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    downloadCsv(result.data.filename, result.data.csv);
  };

  return (
    <div className="space-y-3.5">
      <DateRangeToolbar showExport onExport={handleExport} />

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryKpiCard
          icon={TrendingUp}
          label="Revenue"
          value={formatCurrency(summary.totalSales)}
          iconWrapClass="bg-primary/10"
          iconClass="text-primary"
        />
        <SummaryKpiCard
          icon={Receipt}
          label="Bills"
          value={formatNumber(summary.billCount)}
          iconWrapClass="bg-sky-100"
          iconClass="text-sky-700"
        />
        <SummaryKpiCard
          icon={ShoppingBag}
          label="Items Sold"
          value={formatNumber(itemsSold)}
          iconWrapClass="bg-success-muted"
          iconClass="text-success-icon"
        />
        <SummaryKpiCard
          icon={BarChart3}
          label="Avg Bill"
          value={formatCurrency(avgBill)}
          iconWrapClass="bg-violet-100"
          iconClass="text-violet-700"
        />
      </div>

      {/* Row 1: Top selling products + Payment breakdown */}
      <div className="grid gap-3.5 lg:grid-cols-2 lg:items-stretch">
        <SectionCard
          title="Top Selling Products"
          icon={Package}
          accent="text-[#7C3AED]"
          badgeBg="bg-[#F5F3FF]"
          className="min-h-52"
        >
          {summary.topProducts.length === 0 ? (
            <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-muted-foreground">
              No product data for this period
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {summary.topProducts.map((product, index) => {
                const rank = index + 1;
                return (
                  <li
                    key={product.productId || `${product.productName}-${rank}`}
                    className="flex items-center gap-3 py-2.5 first:pt-0.5 last:pb-0.5"
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
                        rankBadgeClass(rank),
                      )}
                    >
                      #{rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground">
                        {product.productName}
                      </p>
                      <span className="mt-1 inline-flex rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                        Sold: {formatNumber(product.netQty)}
                      </span>
                    </div>
                    <p className="shrink-0 text-[14px] font-bold tabular-nums text-foreground">
                      {formatCurrency(product.netRevenue)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Payment breakdown"
          icon={Wallet}
          accent="text-success"
          badgeBg="bg-success-muted"
          className="min-h-52"
        >
          <PaymentBreakdown
            cash={summary.cashTotal}
            upi={summary.upiTotal}
            card={summary.cardTotal}
            description="Money received on bills (excludes unpaid dues)"
            emptyMessage="No collections for this period"
            chartVariant="dashboard"
            className="h-full min-h-40"
          />
        </SectionCard>
      </div>

      {/* Row 2: Sales profit + Sales trend */}
      <div className="grid gap-3.5 lg:grid-cols-2 lg:items-stretch">
        <SectionCard
          title="Sales Profit"
          icon={TrendingUp}
          accent="text-[#0F766E]"
          badgeBg="bg-[#CCFBF1]"
        >
          {!hasProfitData ? (
            <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-muted-foreground">
              No sales profit data for this period
            </p>
          ) : (
            <div className="space-y-3.5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] text-muted-foreground">
                    Profit on sales
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-[22px] font-bold tabular-nums",
                      profitPositive && "text-success",
                      profitNegative && "text-destructive",
                      !profitPositive && !profitNegative && "text-foreground",
                    )}
                  >
                    {formatCurrency(summary.salesProfit)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] text-muted-foreground">Margin</p>
                  <p
                    className={cn(
                      "mt-0.5 text-[22px] font-bold tabular-nums",
                      profitPositive && "text-success",
                      profitNegative && "text-destructive",
                      !profitPositive && !profitNegative && "text-foreground",
                    )}
                  >
                    {profitMargin.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-lg bg-primary/10 px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground">
                    Item revenue
                  </p>
                  <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-foreground">
                    {formatCurrency(itemRevenue)}
                  </p>
                </div>
                <div className="rounded-lg bg-orange-500/10 px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground">
                    Cost (COGS)
                  </p>
                  <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-foreground">
                    {formatCurrency(summary.cogs)}
                  </p>
                </div>
              </div>

              {summary.returnAmount > 0 ? (
                <p className="text-[12px] text-muted-foreground">
                  Returns deducted: {formatCurrency(summary.returnAmount)}
                </p>
              ) : null}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={trendTitle}
          icon={BarChart3}
          accent="text-primary"
          badgeBg="bg-primary/10"
          className="min-h-52"
        >
          <VerticalTrendChart
            points={summary.trend.map((p) => ({
              label: p.label,
              value: p.sales,
            }))}
          />
        </SectionCard>
      </div>
    </div>
  );
}
