import { Suspense } from "react";

import { SalesAnalyticsPanel } from "@/hooks/features/analytics/components/sales-analytics-panel";
import { requireModuleAccess } from "@/lib/auth/session";
import {
  getRangeLabel,
  getSalesAnalyticsSummary,
} from "@/services/analytics.service";
import type { DateRangePreset } from "@/utils/date";
import { Skeleton } from "@/components/ui/skeleton";

type SalesAnalyticsPageProps = {
  searchParams: Promise<{
    preset?: DateRangePreset;
    from?: string;
    to?: string;
  }>;
};

export default async function SalesAnalyticsPage({
  searchParams,
}: SalesAnalyticsPageProps) {
  await requireModuleAccess("analytics");
  const params = await searchParams;
  const range = {
    preset: params.preset ?? "today",
    from: params.from,
    to: params.to,
  };
  const summary = await getSalesAnalyticsSummary(range);
  const rangeLabel = getRangeLabel(range);

  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-2xl" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28" />
            ))}
          </div>
        </div>
      }
    >
      <SalesAnalyticsPanel summary={summary} rangeLabel={rangeLabel} />
    </Suspense>
  );
}
