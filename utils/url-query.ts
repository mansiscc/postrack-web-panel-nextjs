import { formatISO } from "date-fns";

import { dateRangePresets, type DateRangePreset } from "@/utils/date";

export type SalesDateFilter = "all" | Exclude<DateRangePreset, "custom">;

export function resolveSalesDateRange(date: SalesDateFilter | string | undefined): {
  dateFrom?: string;
  dateTo?: string;
  date: SalesDateFilter;
} {
  const preset =
    date === "today" || date === "week" || date === "month" || date === "last7"
      ? date
      : "all";

  if (preset === "all") {
    return { date: "all" };
  }

  const range = dateRangePresets(preset);
  return {
    date: preset,
    dateFrom: formatISO(range.from),
    dateTo: formatISO(range.to),
  };
}

export function buildQueryString(
  entries: Record<string, string | number | undefined | null>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === null || value === "" || value === "all") {
      continue;
    }
    if (key === "page" && Number(value) <= 1) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
