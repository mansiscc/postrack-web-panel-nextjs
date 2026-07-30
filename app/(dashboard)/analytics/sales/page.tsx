import { Suspense } from "react";

import { SalesAnalyticsPanel } from "@/hooks/features/analytics/components/sales-analytics-panel";
import { AnalyticsPageSkeleton } from "@/components/feedback/page-skeleton";
import { requireModuleAccess } from "@/lib/auth/session";
import {
  getRangeLabel,
  getSalesAnalyticsSummary,
} from "@/services/analytics.service";
import type { DateRangePreset } from "@/utils/date";

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
    <Suspense fallback={<AnalyticsPageSkeleton />}>
      <SalesAnalyticsPanel summary={summary} rangeLabel={rangeLabel} />
    </Suspense>
  );
}
