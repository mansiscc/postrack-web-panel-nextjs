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
