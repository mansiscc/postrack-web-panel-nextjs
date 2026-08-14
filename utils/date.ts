import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";

export function formatDate(
  value: string | Date | null | undefined,
  pattern = "dd MMM yyyy",
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, pattern);
}

export function formatDateTime(
  value: string | Date | null | undefined,
  pattern = "dd MMM yyyy, hh:mm a",
): string {
  return formatDate(value, pattern);
}

export type DateRangePreset = "today" | "week" | "month" | "last7" | "custom";

export function dateRangePresets(preset: Exclude<DateRangePreset, "custom">) {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "week":
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case "month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "last7":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
  }
}

/**
 * Android SalesAnalyticsViewModel.resolveDailyReportDate:
 * Today / This Week / This Month → today;
 * Custom → single day if start==end, else range end.
 */
export function resolveDailySalesReportDateIso(input: {
  preset: DateRangePreset;
  from?: string | null;
  to?: string | null;
}): string {
  const today = format(new Date(), "yyyy-MM-dd");
  const preset = input.preset === "last7" ? "week" : input.preset;
  if (preset !== "custom") return today;

  const from = input.from?.trim() || "";
  const to = input.to?.trim() || "";
  if (from && to) return from === to ? from : to;
  return to || from || today;
}
