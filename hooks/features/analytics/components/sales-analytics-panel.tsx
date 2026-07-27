"use client";

import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { DateRangeToolbar } from "@/hooks/features/analytics/components/date-range-toolbar";
import { PaymentBreakdown } from "@/hooks/features/analytics/components/payment-breakdown";
import { TopRankedTable } from "@/hooks/features/analytics/components/top-ranked-table";
import { TrendBars } from "@/hooks/features/analytics/components/trend-bars";
import { exportSalesAnalyticsCsvAction } from "@/hooks/features/analytics/actions";
import type { SalesAnalyticsSummary } from "@/repositories/analytics.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/utils/currency";
import { downloadCsv } from "@/utils/csv";
import type { DateRangePreset } from "@/utils/date";

type SalesAnalyticsPanelProps = {
  summary: SalesAnalyticsSummary;
  rangeLabel: string;
};

export function SalesAnalyticsPanel({
  summary,
  rangeLabel,
}: SalesAnalyticsPanelProps) {
  const searchParams = useSearchParams();
  const profitMargin =
    summary.netSales > 0
      ? ((summary.salesProfit / summary.netSales) * 100).toFixed(1)
      : "0";

  const kpis = [
    { label: "Total sales", value: formatCurrency(summary.totalSales) },
    { label: "Bill count", value: formatNumber(summary.billCount) },
    { label: "Returns", value: formatCurrency(summary.returnAmount) },
    { label: "Gross profit", value: formatCurrency(summary.salesProfit) },
    { label: "COGS", value: formatCurrency(summary.cogs) },
    { label: "Profit margin", value: `${profitMargin}%` },
    { label: "Items sold (net)", value: formatNumber(summary.topProducts.reduce((sum, item) => sum + item.netQty, 0)) },
  ];

  const handleExport = async () => {
    const result = await exportSalesAnalyticsCsvAction({
      preset: (searchParams.get("preset") as DateRangePreset) || "today",
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
    <div className="space-y-6">
      <DateRangeToolbar showExport onExport={handleExport} />

      <p className="text-sm text-muted-foreground">{rangeLabel}</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.slice(0, 4).map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.slice(4).map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Sales trend</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendBars
              points={summary.trend.map((point) => ({
                label: point.label,
                value: point.sales,
              }))}
            />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Payment breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentBreakdown
              cash={summary.cashTotal}
              upi={summary.upiTotal}
              card={summary.cardTotal}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top selling products</CardTitle>
        </CardHeader>
        <CardContent>
          <TopRankedTable
            title=""
            primaryHeader="Revenue"
            secondaryHeader="Qty"
            rows={summary.topProducts.map((product) => ({
              id: product.productId,
              name: product.productName,
              primary: product.netRevenue,
              secondary: product.netQty,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
