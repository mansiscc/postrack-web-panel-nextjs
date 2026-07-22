import { Suspense } from "react";

import { PurchaseInsightsPanel } from "@/features/analytics/components/purchase-insights-panel";
import { PageHeader } from "@/components/layout/page-header";
import { requireModuleAccess } from "@/lib/auth/session";
import {
  getPurchaseInsightsSummary,
  getRangeLabel,
} from "@/services/analytics.service";
import type { DateRangePreset } from "@/utils/date";
import { Skeleton } from "@/components/ui/skeleton";

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
    <>
      <PageHeader
        title="Purchase insights"
        description="Analyze procurement trends and stock-in data."
      />
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
        <PurchaseInsightsPanel summary={summary} rangeLabel={rangeLabel} />
      </Suspense>
    </>
  );
}
