import { format } from "date-fns";

import {
  getPurchaseInsights,
  getSalesAnalytics,
  type PurchaseInsightsSummary,
  type SalesAnalyticsSummary,
} from "@/repositories/analytics.repository";
import { createClient } from "@/lib/supabase/server";
import type { DateRangePreset } from "@/utils/date";
import { dateRangePresets } from "@/utils/date";

type AnalyticsRange = {
  preset: DateRangePreset;
  from?: string;
  to?: string;
};

function resolveRange(range: AnalyticsRange) {
  if (range.preset === "custom" && range.from && range.to) {
    const from = new Date(`${range.from}T00:00:00`);
    const to = new Date(`${range.to}T23:59:59.999`);
    return { from, to };
  }

  const preset =
    range.preset === "custom" ? "today" : range.preset === "last7" ? "last7" : range.preset;
  const { from, to } = dateRangePresets(preset);

  return { from, to };
}

export async function getSalesAnalyticsSummary(
  range: AnalyticsRange,
): Promise<SalesAnalyticsSummary> {
  const supabase = await createClient();
  const { from, to } = resolveRange(range);

  // Always daily buckets — matches app "Sales Trend (Daily)" for week/month
  // and keeps axis labels as dates (not Jul / W30).
  return getSalesAnalytics(supabase, {
    start: from.toISOString(),
    end: to.toISOString(),
    bucket: "day",
  });
}

export async function getPurchaseInsightsSummary(
  range: AnalyticsRange,
): Promise<PurchaseInsightsSummary> {
  const supabase = await createClient();
  const { from, to } = resolveRange(range);
  return getPurchaseInsights(supabase, { start: from, end: to });
}

export function getRangeLabel(range: AnalyticsRange): string {
  if (range.preset === "custom" && range.from && range.to) {
    return `${format(new Date(range.from), "dd MMM yyyy")} – ${format(new Date(range.to), "dd MMM yyyy")}`;
  }
  switch (range.preset) {
    case "today":
      return "Today";
    case "week":
      return "This week";
    case "month":
      return "This month";
    case "last7":
      return "Last 7 days";
    default:
      return "Today";
  }
}
