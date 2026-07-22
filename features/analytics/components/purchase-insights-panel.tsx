"use client";

import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { DateRangeToolbar } from "@/features/analytics/components/date-range-toolbar";
import { TopRankedTable } from "@/features/analytics/components/top-ranked-table";
import { TrendBars } from "@/features/analytics/components/trend-bars";
import { exportPurchaseInsightsCsvAction } from "@/features/analytics/actions";
import type { PurchaseInsightsSummary } from "@/repositories/analytics.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/utils/currency";
import { downloadCsv } from "@/utils/csv";
import type { DateRangePreset } from "@/utils/date";

type PurchaseInsightsPanelProps = {
  summary: PurchaseInsightsSummary;
  rangeLabel: string;
};

export function PurchaseInsightsPanel({
  summary,
  rangeLabel,
}: PurchaseInsightsPanelProps) {
  const searchParams = useSearchParams();
  const kpis = [
    { label: "Total purchase", value: formatCurrency(summary.totalSpend) },
    { label: "Purchase count", value: formatNumber(summary.purchaseCount) },
    { label: "Items received", value: formatNumber(summary.totalItems) },
    {
      label: "Avg per purchase",
      value: formatCurrency(
        summary.purchaseCount > 0
          ? summary.totalSpend / summary.purchaseCount
          : 0,
      ),
    },
  ];

  const handleExport = async () => {
    const result = await exportPurchaseInsightsCsvAction({
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
        {kpis.map((kpi) => (
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Purchase trend</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendBars
            points={summary.trend.map((point) => ({
              label: point.label,
              value: point.spend,
            }))}
            valueLabel="Daily purchase spend"
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <TopRankedTable
              title="Top suppliers by spend"
              primaryHeader="Spend"
              secondaryHeader="Purchases"
              rows={summary.topSuppliers.map((supplier, index) => ({
                id: supplier.supplierId ?? `walk-in-${index}`,
                name: supplier.supplierName,
                primary: supplier.totalSpend,
                secondary: supplier.purchaseCount,
              }))}
              formatSecondary={(value) => formatNumber(Number(value))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <TopRankedTable
              title="Top purchased products"
              primaryHeader="Spend"
              secondaryHeader="Qty"
              rows={summary.topProducts.map((product) => ({
                id: product.productId,
                name: product.productName,
                primary: product.totalSpend,
                secondary: product.totalQty,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
