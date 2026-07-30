import { Suspense } from "react";

import { PurchaseInsightsPanel } from "@/hooks/features/analytics/components/purchase-insights-panel";
import { AnalyticsPageSkeleton } from "@/components/feedback/page-skeleton";
import { requireModuleAccess } from "@/lib/auth/session";
import {
  getPurchaseInsightsSummary,
  getRangeLabel,
} from "@/services/analytics.service";
import type { DateRangePreset } from "@/utils/date";

type PurchaseInsightsPageProps = {
  searchParams: Promise<{
    preset?: DateRangePreset;
    from?: string;
    to?: string;
  }>;
};

export default async function PurchaseInsightsPage({
  searchParams,
}: PurchaseInsightsPageProps) {
  await requireModuleAccess("analytics");
  const params = await searchParams;
  const range = {
    preset: params.preset ?? "today",
    from: params.from,
    to: params.to,
  };
  const summary = await getPurchaseInsightsSummary(range);
  const rangeLabel = getRangeLabel(range);

  return (
    <Suspense fallback={<AnalyticsPageSkeleton />}>
      <PurchaseInsightsPanel summary={summary} rangeLabel={rangeLabel} />
    </Suspense>
  );
}
