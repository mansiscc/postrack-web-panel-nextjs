"use client";

import {
  Building2,
  CalendarDays,
  Package,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  Truck,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { DateRangeToolbar } from "@/hooks/features/analytics/components/date-range-toolbar";
import { exportPurchaseInsightsCsvAction } from "@/hooks/features/analytics/actions";
import type { PurchaseInsightsSummary } from "@/repositories/analytics.repository";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/utils/currency";
import { downloadCsv } from "@/utils/csv";
import { formatDate } from "@/utils/date";
import type { DateRangePreset } from "@/utils/date";

type PurchaseInsightsPanelProps = {
  summary: PurchaseInsightsSummary;
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
        "flex min-h-0 flex-col overflow-hidden rounded-lg bg-card shadow-card",
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
      <div className="flex min-h-0 flex-col p-3">{children}</div>
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

import {
  buildContinuousTrendPoints,
  type ContinuousTrendPoint,
} from "@/hooks/features/analytics/components/trend-bars";

function formatTrendLabel(label: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    return String(Number(label.slice(8)));
  }
  if (/^\d{4}-\d{2}$/.test(label)) {
    return "1";
  }
  if (/^\d{4}-W\d{2}$/i.test(label)) {
    return label.slice(5);
  }
  return label;
}

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function formatTooltipLabel(label: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    return formatDate(label, "dd MMM yyyy");
  }
  if (/^\d{1,2}$/.test(label)) {
    return `${label.padStart(2, "0")}:00`;
  }
  return label;
}

function VerticalTrendChart({
  points,
  isScrollable = false,
}: {
  points: Array<{ label: string; displayLabel?: string; value: number }>;
  isScrollable?: boolean;
}) {
  const hasTrend = points.some((point) => point.value > 0);
  if (!points.length || !hasTrend) {
    return (
      <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted-foreground">
        No purchase trend data for this period
      </p>
    );
  }

  const max = Math.max(...points.map((point) => Math.abs(point.value)), 1);
  const barAreaHeight = 150;

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          "w-full pt-1",
          isScrollable ? "overflow-x-auto pb-2.5" : "overflow-hidden",
        )}
      >
        <div
          className={cn(
            "flex items-end gap-1 px-1",
            isScrollable ? "min-w-full" : "w-full",
          )}
          style={{
            minWidth: isScrollable
              ? `${Math.max(points.length * 36, 100)}px`
              : undefined,
            height: `${barAreaHeight + 24}px`,
          }}
        >
          {points.map((point) => {
            const fraction = Math.abs(point.value) / max;
            const barHeight = Math.max(
              fraction * barAreaHeight,
              point.value > 0 ? 4 : 2,
            );
            const labelText = point.displayLabel || formatTrendLabel(point.label);
            return (
              <Tooltip key={point.label}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "group flex flex-1 cursor-pointer flex-col items-center justify-end px-0.5",
                      isScrollable && "min-w-[36px]",
                    )}
                  >
                    <div
                      className={cn(
                        "w-[70%] max-w-6 rounded-t-sm transition-all group-hover:brightness-110",
                        point.value > 0 ? "bg-success/80" : "bg-border/60",
                      )}
                      style={{
                        height: barHeight,
                        opacity: point.value > 0 ? 0.55 + fraction * 0.45 : 0.35,
                      }}
                    />
                    <span className="mt-1.5 flex h-4 w-full items-center justify-center truncate text-[10px] font-medium leading-none text-muted-foreground select-none sm:text-[11px]">
                      {labelText}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="flex items-center gap-1.5 px-3 py-1.5 text-xs shadow-md">
                  <span className="font-semibold text-foreground">
                    {formatTooltipLabel(point.label)}
                  </span>
                  <span className="text-muted-foreground">:</span>
                  <span className="font-bold tabular-nums text-success">
                    {formatCurrency(point.value)}
                  </span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

function supplierRankClass(rank: number) {
  if (rank === 1) return "bg-success-muted text-success-icon";
  if (rank === 2) return "bg-sky-100 text-sky-700";
  if (rank === 3) return "bg-orange-100 text-orange-600";
  return "bg-violet-100 text-violet-700";
}

export function PurchaseInsightsPanel({
  summary,
}: PurchaseInsightsPanelProps) {
  const searchParams = useSearchParams();
  const preset = (searchParams.get("preset") as DateRangePreset) || "today";
  const avgPurchase =
    summary.purchaseCount > 0
      ? summary.totalSpend / summary.purchaseCount
      : 0;

  const handleExport = async () => {
    const result = await exportPurchaseInsightsCsvAction({
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
      <DateRangeToolbar
        showExport
        onExport={handleExport}
        accent="success"
      />

      {/* App KPIs: Total Spend / Purchases / Total Items / Avg Purchase */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryKpiCard
          icon={TrendingUp}
          label="Total Spend"
          value={formatCurrency(summary.totalSpend)}
          iconWrapClass="bg-success-muted"
          iconClass="text-success-icon"
        />
        <SummaryKpiCard
          icon={ReceiptText}
          label="Purchases"
          value={formatNumber(summary.purchaseCount)}
          iconWrapClass="bg-sky-100"
          iconClass="text-sky-700"
        />
        <SummaryKpiCard
          icon={ShoppingCart}
          label="Total Items"
          value={formatNumber(summary.totalItems)}
          iconWrapClass="bg-violet-100"
          iconClass="text-violet-700"
        />
        <SummaryKpiCard
          icon={CalendarDays}
          label="Avg Purchase"
          value={formatCurrency(avgPurchase)}
          iconWrapClass="bg-orange-100"
          iconClass="text-orange-600"
        />
      </div>

      {/* Desktop: Top suppliers + Recent purchases (app sections) */}
      <div className="grid gap-3.5 lg:grid-cols-2 lg:items-stretch">
        <SectionCard
          title="Top Suppliers by Spend"
          icon={Building2}
          accent="text-success-icon"
          badgeBg="bg-success-muted"
          className="min-h-52"
        >
          {summary.topSuppliers.length === 0 ? (
            <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-muted-foreground">
              No supplier data for this period
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {summary.topSuppliers.map((supplier, index) => {
                const rank = index + 1;
                return (
                  <li
                    key={supplier.supplierId ?? `walk-in-${rank}`}
                    className="flex items-center gap-3 py-2.5 first:pt-0.5 last:pb-0.5"
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
                        supplierRankClass(rank),
                      )}
                    >
                      #{rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground">
                        {supplier.supplierName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {supplier.purchaseCount} purchase
                        {supplier.purchaseCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p className="shrink-0 text-[14px] font-bold tabular-nums text-foreground">
                      {formatCurrency(supplier.totalSpend)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Recent Purchases"
          icon={ReceiptText}
          accent="text-sky-700"
          badgeBg="bg-sky-100"
          className="min-h-52"
        >
          {summary.recentPurchases.length === 0 ? (
            <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-muted-foreground">
              No purchases in this period
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {summary.recentPurchases.map((purchase) => (
                <li
                  key={purchase.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0.5 last:pb-0.5"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sky-100">
                    <Truck className="size-4 text-sky-700" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground">
                      {purchase.supplierName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatDate(purchase.date)}
                    </p>
                    {purchase.invoiceNumber ? (
                      <p className="text-[10px] text-muted-foreground">
                        Invoice: {purchase.invoiceNumber}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[14px] font-bold tabular-nums text-foreground">
                      {formatCurrency(purchase.totalAmount)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {purchase.totalItems} item
                      {purchase.totalItems === 1 ? "" : "s"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Desktop enrichment: trend + top products */}
      <div className="grid gap-3.5 lg:grid-cols-2 lg:items-start">
        <SectionCard
          title={
            preset === "today"
              ? "Purchase Trend (Hourly)"
              : preset === "week" || preset === "month" || preset === "last7"
                ? "Purchase Trend (Daily)"
                : "Purchase Trend"
          }
          icon={TrendingUp}
          accent="text-success-icon"
          badgeBg="bg-success-muted"
          className="self-start"
        >
          <VerticalTrendChart
            points={buildContinuousTrendPoints(
              summary.trend.map((point) => ({
                label: point.label,
                value: point.spend,
              })),
              preset,
              searchParams.get("from"),
              searchParams.get("to"),
            )}
            isScrollable={preset === "custom"}
          />
        </SectionCard>

        <SectionCard
          title="Top Purchased Products"
          icon={Package}
          accent="text-violet-700"
          badgeBg="bg-violet-100"
          className="self-start"
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
                    key={product.productId}
                    className="flex items-center gap-3 py-2.5 first:pt-0.5 last:pb-0.5"
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
                        supplierRankClass(rank),
                      )}
                    >
                      #{rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground">
                        {product.productName}
                      </p>
                      <span className="mt-1 inline-flex rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                        Qty: {formatNumber(product.totalQty)}
                      </span>
                    </div>
                    <p className="shrink-0 text-[14px] font-bold tabular-nums text-foreground">
                      {formatCurrency(product.totalSpend)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
