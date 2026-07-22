"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { PaymentBreakdown } from "@/features/analytics/components/payment-breakdown";
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
    { label: "Bills", value: formatNumber(totals.billCount), href: "/sales" },
    {
      label: "Today's sales",
      value: formatCurrency(totals.todaySales),
      href: "/sales",
    },
    {
      label: "Purchase",
      value: formatCurrency(totals.todayPurchase),
      href: "/purchases",
    },
    {
      label: "Extra income",
      value: formatCurrency(totals.todayManualIncome),
      href: "/transactions",
    },
    {
      label: "Other expense",
      value: formatCurrency(totals.todayManualExpense),
      href: "/transactions",
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
    { label: "Sales", href: "/sales" },
    { label: "Purchases", href: "/purchases" },
    { label: "Transactions", href: "/transactions" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-muted-foreground">{todayLabel}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => startTransition(() => router.refresh())}
        >
          <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((kpi) => {
          const content = (
            <Card
              className={cn(
                kpi.href && "transition-colors hover:bg-accent/40",
                kpi.tone === "success" && "border-emerald-200",
                kpi.tone === "danger" && "border-rose-200",
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-[13px] font-medium text-muted-foreground">
                  {kpi.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{kpi.value}</p>
              </CardContent>
            </Card>
          );

          return kpi.href ? (
            <Link key={kpi.label} href={kpi.href}>
              {content}
            </Link>
          ) : (
            <div key={kpi.label}>{content}</div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Sales profit summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {profitMetrics.map((metric) => (
                <div key={metric.label}>
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Payment breakdown</CardTitle>
          </CardHeader>
          <CardContent>
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
          <CardHeader>
            <CardTitle className="text-base">Refunds today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {formatNumber(totals.todayReturnsCount)} returns
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatCurrency(totals.todayReturnAmount)} refunded
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inventory alerts</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Active products</p>
              <p className="text-xl font-semibold tabular-nums">
                {formatNumber(totals.totalProducts)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Low stock</p>
              <p className="text-xl font-semibold tabular-nums text-amber-600">
                {formatNumber(totals.lowStockCount)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Out of stock</p>
              <p className="text-xl font-semibold tabular-nums text-rose-600">
                {formatNumber(totals.outOfStockCount)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inactive</p>
              <p className="text-xl font-semibold tabular-nums">
                {formatNumber(totals.inactiveProductCount)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Out of stock products</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/products">View all products</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {totals.outOfStockProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No out-of-stock products right now.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {totals.outOfStockProducts.map((product) => (
                  <TableRow key={product.name}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-right tabular-nums text-rose-600">
                      {formatNumber(product.stock_quantity)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="link" size="sm">
                        <Link href="/products">View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {quickActions.map((action) => (
          <Button key={action.label} asChild variant="outline">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
