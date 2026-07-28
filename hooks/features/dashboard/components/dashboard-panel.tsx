"use client";

import {
  TrendingUp,
  Wallet,
  Package,
  RotateCcw,
  ShoppingBag,
  AlertTriangle,
  XCircle,
  PowerOff,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PaymentBreakdown } from "@/hooks/features/analytics/components/payment-breakdown";
import type { DashboardTotalsRow } from "@/repositories/dashboard.repository";
import { formatCurrency, formatNumber } from "@/utils/currency";
import { cn } from "@/lib/utils";

type DashboardPanelProps = {
  totals: DashboardTotalsRow;
  todayLabel: string;
};

/* ─── Shared section-card shell (mirrors Android SectionCard) ─────────────── */
function SectionCard({
  title,
  icon: Icon,
  accent,
  badgeBg,
  children,
  href,
  className,
}: {
  title: string;
  icon: React.ElementType;
  accent: string;       // tailwind text-* colour class
  badgeBg: string;      // tailwind bg-* colour class
  children: React.ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg bg-card shadow-card overflow-hidden flex flex-col",
        className,
      )}
    >
      {/* Icon badge + title header row */}
      <div className="flex items-center gap-3 px-3.5 py-3 border-b border-border/40 shrink-0">
        <span className={cn("flex items-center justify-center rounded-md p-1.5", badgeBg)}>
          <Icon className={cn("size-4", accent)} strokeWidth={2} />
        </span>
        <span className="flex-1 text-[13px] font-bold text-foreground">{title}</span>
        {href && (
          <Link href={href} className={cn("text-[11px] font-semibold flex items-center gap-0.5", accent)}>
            View <ChevronRight className="size-3" />
          </Link>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col min-h-0">{children}</div>
    </div>
  );
}

/* ─── Stat tile with diagonal accent gradient (mirrors Android SmallStat) ─── */
function StatTile({
  label,
  value,
  icon: Icon,
  iconTint,   // tailwind text-* class
  iconBg,     // tailwind bg-* class
  gradientFrom, // tailwind from-* class
  gradientTo,   // tailwind to-* class
  href,
  valueClass,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  iconTint: string;
  iconBg: string;
  gradientFrom: string;
  gradientTo: string;
  href?: string;
  valueClass?: string;
}) {
  const inner = (
    <div
      className={cn(
        "relative min-h-18 rounded-md p-2.5 bg-linear-to-br",
        gradientFrom,
        gradientTo,
      )}
    >
      {/* Icon badge top-right */}
      <span
        className={cn(
          "absolute top-2 right-2 flex items-center justify-center rounded-md p-1.5",
          iconBg,
        )}
      >
        <Icon className={cn("size-4", iconTint)} strokeWidth={2} />
      </span>
      <p className="text-[12px] font-medium leading-normal text-muted-foreground pr-10 truncate">
        {label}
      </p>
      <p className={cn("mt-1.5 text-[17px] font-bold tabular-nums", valueClass)}>
        {value}
      </p>
    </div>
  );

  return href ? (
    <Link href={href} className="block transition-opacity hover:opacity-90">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/* ─── KPI tile inside Today's Summary (mirrors Android SummaryKpiTile) ────── */
function KpiTile({
  label,
  value,
  href,
  valueClass,
}: {
  label: string;
  value: string;
  href?: string;
  valueClass?: string;
}) {
  const inner = (
    <div className="rounded-md bg-surface-variant px-2.5 py-2 transition-colors hover:bg-primary-muted/60">
      <p className="text-[12px] font-semibold capitalize text-muted-foreground truncate">
        {label}
      </p>
      <p className={cn("mt-1 text-[15px] font-bold tabular-nums", valueClass)}>
        {value}
      </p>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/* ─── Main component ──────────────────────────────────────────────────────── */
export function DashboardPanel({ totals, todayLabel }: DashboardPanelProps) {
  const router = useRouter();

  const profitValueClass =
    totals.todayProfit < 0
      ? "text-destructive"
      : totals.todayProfit > 0
        ? "text-success"
        : undefined;

  const profitMargin =
    totals.todaySalesRevenue > 0
      ? ((totals.todaySalesProfit / totals.todaySalesRevenue) * 100).toFixed(1)
      : "0";

  const showOutOfStockSection =
    totals.outOfStockCount > 0 || totals.outOfStockProducts.length > 0;

  return (
    <div className="space-y-3.5">

      {/* ── Today's Summary — gradient header card ─────────────────── */}
      <div className="rounded-lg bg-card shadow-card overflow-hidden">
        {/* Gradient header: cherry → indigo → sky (exact Android colours) */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{
            background:
              "linear-gradient(to right, rgba(210,18,46,0.20), rgba(99,102,241,0.16), rgba(14,165,233,0.12))",
          }}
        >
          <div>
            <p className="text-[15px] font-bold text-foreground">Today&apos;s summary</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{todayLabel}</p>
          </div>
          <TrendingUp className="size-5 text-primary" strokeWidth={2} />
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 xl:grid-cols-6">
          <KpiTile
            label="Bills"
            value={formatNumber(totals.billCount)}
            href="/sales?date=today"
          />
          <KpiTile
            label="Bills total"
            value={formatCurrency(totals.todaySales)}
            href="/sales?date=today"
          />
          <KpiTile
            label="Purchase"
            value={formatCurrency(totals.todayPurchase)}
            href="/purchases"
          />
          <KpiTile
            label="Extra income"
            value={formatCurrency(totals.todayManualIncome)}
            href="/transactions?type=income&date=today"
          />
          <KpiTile
            label="Other expense"
            value={formatCurrency(totals.todayManualExpense)}
            href="/transactions?type=expense&date=today"
          />
          <KpiTile
            label="Today's profit"
            value={formatCurrency(totals.todayProfit)}
            valueClass={profitValueClass}
          />
        </div>
      </div>

      {/* ── Row 1–2: Sales profit + Refunds (left) | Payment breakdown spans both (right) ── */}
      <div className="grid gap-3.5 lg:grid-cols-2 lg:grid-rows-[auto_auto]">
        <SectionCard
          title="Sales profit"
          icon={TrendingUp}
          accent="text-[#0F766E]"
          badgeBg="bg-[#CCFBF1]"
          href="/analytics/sales"
          className="h-full lg:col-start-1 lg:row-start-1"
        >
          <div className="grid grid-cols-2 gap-2">
            <StatTile
              label="Revenue"
              value={formatCurrency(totals.todaySalesRevenue)}
              icon={TrendingUp}
              iconTint="text-[#0F766E]"
              iconBg="bg-[#CCFBF1]"
              gradientFrom="from-surface-variant"
              gradientTo="to-[#CCFBF1]/40"
            />
            <StatTile
              label="COGS"
              value={formatCurrency(totals.todayCogs)}
              icon={ShoppingBag}
              iconTint="text-[#EA580C]"
              iconBg="bg-[#FFF7ED]"
              gradientFrom="from-surface-variant"
              gradientTo="to-[#FFF7ED]/60"
            />
            <StatTile
              label="Profit"
              value={formatCurrency(totals.todaySalesProfit)}
              icon={TrendingUp}
              iconTint={totals.todaySalesProfit >= 0 ? "text-[#0D9488]" : "text-destructive"}
              iconBg={totals.todaySalesProfit >= 0 ? "bg-[#CCFBF1]" : "bg-destructive-muted"}
              gradientFrom="from-surface-variant"
              gradientTo={totals.todaySalesProfit >= 0 ? "to-[#CCFBF1]/40" : "to-destructive-muted/40"}
              valueClass={totals.todaySalesProfit >= 0 ? "text-[#0D9488]" : "text-destructive"}
            />
            <StatTile
              label="Margin"
              value={`${profitMargin}%`}
              icon={TrendingUp}
              iconTint="text-[#0F766E]"
              iconBg="bg-[#CCFBF1]"
              gradientFrom="from-surface-variant"
              gradientTo="to-[#CCFBF1]/40"
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Refunds today"
          icon={RotateCcw}
          accent="text-[#BE123C]"
          badgeBg="bg-[#FFE4E6]"
          href="/sales?status=RETURNED"
          className="h-full lg:col-start-1 lg:row-start-2"
        >
          <div className="grid grid-cols-2 gap-2">
            <StatTile
              label="Refund count"
              value={formatNumber(totals.todayReturnsCount)}
              icon={RotateCcw}
              iconTint="text-[#0369A1]"
              iconBg="bg-info-muted"
              gradientFrom="from-surface-variant"
              gradientTo="to-info-muted/50"
            />
            <StatTile
              label="Refund amount"
              value={formatCurrency(totals.todayReturnAmount)}
              icon={RotateCcw}
              iconTint="text-[#BE123C]"
              iconBg="bg-[#FFE4E6]"
              gradientFrom="from-surface-variant"
              gradientTo="to-[#FFE4E6]/70"
              valueClass="text-[#BE123C]"
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Payment breakdown"
          icon={Wallet}
          accent="text-success"
          badgeBg="bg-success-muted"
          className="h-full lg:col-start-2 lg:row-start-1 lg:row-span-2"
        >
          <PaymentBreakdown
            cash={totals.cashTotal}
            upi={totals.upiTotal}
            card={totals.cardTotal}
            description="Money received on today's bills (excludes unpaid dues)"
            chartVariant="dashboard"
            className="h-full"
          />
        </SectionCard>
      </div>

      {/* ── Row 3: Inventory summary + Out of stock products ─────────── */}
      <div className="grid gap-3.5 lg:grid-cols-2">
        <SectionCard
          title="Inventory summary"
          icon={Package}
          accent="text-[#7C3AED]"
          badgeBg="bg-[#F5F3FF]"
          href="/inventory"
          className={cn("h-full", !showOutOfStockSection && "lg:col-span-2")}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile
              label="Total products"
              value={formatNumber(totals.totalProducts)}
              icon={ShoppingBag}
              iconTint="text-[#7C3AED]"
              iconBg="bg-[#F5F3FF]"
              gradientFrom="from-surface-variant"
              gradientTo="to-[#F5F3FF]/70"
              href="/inventory"
            />
            <StatTile
              label="Low stock"
              value={formatNumber(totals.lowStockCount)}
              icon={AlertTriangle}
              iconTint="text-[#B45309]"
              iconBg="bg-[#FEF3C7]"
              gradientFrom="from-surface-variant"
              gradientTo="to-[#FEF3C7]/70"
              valueClass="text-warning"
              href="/inventory?stock=low_stock"
            />
            <StatTile
              label="Out of stock"
              value={formatNumber(totals.outOfStockCount)}
              icon={XCircle}
              iconTint="text-destructive"
              iconBg="bg-destructive-muted"
              gradientFrom="from-surface-variant"
              gradientTo="to-destructive-muted/50"
              valueClass="text-destructive"
              href="/inventory?stock=out_of_stock"
            />
            <StatTile
              label="Inactive products"
              value={formatNumber(totals.inactiveProductCount)}
              icon={PowerOff}
              iconTint="text-muted-foreground"
              iconBg="bg-muted"
              gradientFrom="from-surface-variant"
              gradientTo="to-muted/50"
              href="/products?status=inactive"
            />
          </div>
        </SectionCard>

        {showOutOfStockSection ? (
          <SectionCard
            title="Out of stock products"
            icon={Package}
            accent="text-destructive"
            badgeBg="bg-destructive-muted"
            href="/inventory?stock=out_of_stock"
            className="h-full"
          >
            {totals.outOfStockProducts.length === 0 ? (
              <div className="rounded-md bg-surface-variant px-2.5 py-2">
                <p className="text-[13px] text-muted-foreground">
                  No out of stock products
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {totals.outOfStockProducts.map((product) => (
                  <button
                    key={product.name}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 py-2 text-left transition-colors hover:bg-primary-muted/40"
                    onClick={() =>
                      router.push(
                        `/inventory?stock=out_of_stock&q=${encodeURIComponent(product.name)}`,
                      )
                    }
                  >
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">
                      {product.name}
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-muted-foreground">
                      Stock: {formatNumber(product.stock_quantity)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {totals.outOfStockCount > totals.outOfStockProducts.length ? (
              <Link
                href="/inventory?stock=out_of_stock"
                className="mt-2 block py-2.5 text-center text-[13px] font-semibold text-destructive hover:underline"
              >
                Show more (+
                {totals.outOfStockCount - totals.outOfStockProducts.length})
              </Link>
            ) : null}
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}
