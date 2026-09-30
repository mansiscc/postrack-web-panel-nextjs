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

  // SQL uses `created_at < p_end`, so end boundary is start of next millisecond / day
  const exclusiveEnd = new Date(to.getTime() + 1);

  if (range.preset === "today") {
    // For Today, aggregate 24 hourly buckets (00..23) to match Android app's "Sales Trend (Hourly)"
    const [summary, { data: bills }] = await Promise.all([
      getSalesAnalytics(supabase, {
        start: from.toISOString(),
        end: exclusiveEnd.toISOString(),
        bucket: "day",
      }),
      supabase
        .from("bills")
        .select("created_at, total_payable_amount")
        .gte("created_at", from.toISOString())
        .lt("created_at", exclusiveEnd.toISOString()),
    ]);

    const hourlyMap = new Map<string, number>();
    for (let h = 0; h < 24; h++) {
      hourlyMap.set(String(h).padStart(2, "0"), 0);
    }

    for (const bill of bills ?? []) {
      if (bill.created_at) {
        const hour = format(new Date(bill.created_at), "HH");
        const current = hourlyMap.get(hour) ?? 0;
        hourlyMap.set(hour, current + (bill.total_payable_amount ?? 0));
      }
    }

    summary.trend = Array.from(hourlyMap.entries()).map(([label, sales]) => ({
      label,
      sales,
    }));

    return summary;
  }

  return getSalesAnalytics(supabase, {
    start: from.toISOString(),
    end: exclusiveEnd.toISOString(),
    bucket: "day",
  });
}

export async function getPurchaseInsightsSummary(
  range: AnalyticsRange,
): Promise<PurchaseInsightsSummary> {
  const supabase = await createClient();
  const { from, to } = resolveRange(range);
  return getPurchaseInsights(supabase, {
    start: from,
    end: to,
    isHourly: range.preset === "today",
  });
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
