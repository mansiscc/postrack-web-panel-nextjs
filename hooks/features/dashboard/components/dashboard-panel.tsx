"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { PaymentBreakdown } from "@/hooks/features/analytics/components/payment-breakdown";
import type { DashboardTotalsRow } from "@/repositories/dashboard.repository";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/utils/currency";
import { cn } from "@/lib/utils";

type DashboardPanelProps = {
  totals: DashboardTotalsRow;
  todayLabel: string;
};

type KpiCard = {
  label: string;
  value: string;
  href?: string;
  tone?: "default" | "warning" | "danger" | "success";
};

export function DashboardPanel({ totals, todayLabel }: DashboardPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const kpis: KpiCard[] = [
    {
      label: "Bills",
      value: formatNumber(totals.billCount),
      href: "/sales?date=today",
    },
    {
      label: "Today's sales",
      value: formatCurrency(totals.todaySales),
      href: "/sales?date=today",
    },
    {
      label: "Purchase",
      value: formatCurrency(totals.todayPurchase),
      href: "/purchases",
    },
    {
      label: "Extra income",
      value: formatCurrency(totals.todayManualIncome),
      href: "/transactions?type=income&date=today",
    },
    {
      label: "Other expense",
      value: formatCurrency(totals.todayManualExpense),
      href: "/transactions?type=expense&date=today",
    },
    {
      label: "Today's profit",
      value: formatCurrency(totals.todayProfit),
      tone: totals.todayProfit >= 0 ? "success" : "danger",
    },
  ];

  const profitMetrics = [
    { label: "Revenue", value: formatCurrency(totals.todaySalesRevenue) },
    { label: "COGS", value: formatCurrency(totals.todayCogs) },
    { label: "Profit", value: formatCurrency(totals.todaySalesProfit) },
    {
      label: "Margin",
      value: `${formatNumber(totals.todaySalesProfitMargin)}%`,
    },
  ];

  const quickActions = [
    { label: "Products", href: "/products" },
    { label: "Sales", href: "/sales?date=today" },
    { label: "Purchases", href: "/purchases" },
    { label: "Transactions", href: "/transactions?date=today" },
  ];

  return (
    <div className="space-y-4">
      {/* Today's summary — stacked section card with compact KPI tiles */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-muted/40 py-3">
          <div>
            <CardTitle>Today&apos;s summary</CardTitle>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {todayLabel}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => startTransition(() => router.refresh())}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isPending && "animate-spin")}
            />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {kpis.map((kpi) => {
              const tile = (
                <div
                  className={cn(
                    "rounded-lg bg-muted/30 px-3 py-2.5 transition-colors",
                    kpi.href && "hover:bg-muted/50",
                    kpi.tone === "success" && "border border-success/40",
                    kpi.tone === "danger" && "border border-destructive/40",
                  )}
                >
                  <p className="text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
                    {kpi.label}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-lg font-bold tracking-tight tabular-nums",
                      kpi.tone === "success" && "text-success",
                      kpi.tone === "danger" && "text-destructive",
                    )}
                  >
                    {kpi.value}
                  </p>
                </div>
              );

              return kpi.href ? (
                <Link key={kpi.label} href={kpi.href} className="block">
                  {tile}
                </Link>
              ) : (
                <div key={kpi.label}>{tile}</div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="border-b border-border bg-muted/40 py-3">
            <CardTitle>Sales profit summary</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {profitMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-lg bg-muted/30 px-3 py-2.5"
                >
                  <p className="text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
                    {metric.label}
                  </p>
                  <p className="mt-1 text-[15px] font-bold tabular-nums">
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border bg-muted/40 py-3">
            <CardTitle>Payment breakdown</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <PaymentBreakdown
              cash={totals.cashTotal}
              upi={totals.upiTotal}
              card={totals.cardTotal}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border bg-muted/40 py-3">
            <CardTitle>Refunds today</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <p className="text-xl font-bold tracking-tight tabular-nums">
              {formatNumber(totals.todayReturnsCount)} returns
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {formatCurrency(totals.todayReturnAmount)} refunded
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b border-border bg-muted/40 py-3">
            <CardTitle>Inventory alerts</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 pt-3 sm:grid-cols-2">
            <Link href="/inventory" className="rounded-lg bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50">
              <p className="text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
                Active products
              </p>
              <p className="mt-1 text-[15px] font-bold tabular-nums">
                {formatNumber(totals.totalProducts)}
              </p>
            </Link>
            <Link
              href="/inventory?stock=low_stock"
              className="rounded-lg bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <p className="text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
                Low stock
              </p>
              <p className="mt-1 text-[15px] font-bold tabular-nums text-warning">
                {formatNumber(totals.lowStockCount)}
              </p>
            </Link>
            <Link
              href="/inventory?stock=out_of_stock"
              className="rounded-lg bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <p className="text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
                Out of stock
              </p>
              <p className="mt-1 text-[15px] font-bold tabular-nums text-destructive">
                {formatNumber(totals.outOfStockCount)}
              </p>
            </Link>
            <Link
              href="/products?status=inactive"
              className="rounded-lg bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <p className="text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
                Inactive
              </p>
              <p className="mt-1 text-[15px] font-bold tabular-nums">
                {formatNumber(totals.inactiveProductCount)}
              </p>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-muted/40 py-3">
          <CardTitle>Out of stock products</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/inventory?stock=out_of_stock">View inventory</Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0 pt-0">
          {totals.outOfStockProducts.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              No out-of-stock products right now.
            </p>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 text-[11px] font-semibold tracking-[0.04em] uppercase">
                    Product
                  </TableHead>
                  <TableHead className="px-4 text-[11px] font-semibold tracking-[0.04em] uppercase">
                    Stock
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {totals.outOfStockProducts.map((product) => (
                  <TableRow
                    key={product.name}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/inventory?stock=out_of_stock&q=${encodeURIComponent(product.name)}`,
                      )
                    }
                  >
                    <TableCell className="px-4 py-2.5 text-[13px] font-medium">
                      {product.name}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-[13px] tabular-nums text-destructive">
                      {formatNumber(product.stock_quantity)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => (
          <Button
            key={action.label}
            asChild
            variant="outline"
            className="h-10 justify-between rounded-xl px-4 font-semibold"
          >
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
