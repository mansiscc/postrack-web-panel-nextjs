import { eachDayOfInterval, format } from "date-fns";

import { dateRangePresets, type DateRangePreset } from "@/utils/date";
import { formatCurrency } from "@/utils/currency";

export type ContinuousTrendPoint = {
  label: string;
  displayLabel: string;
  value: number;
};

export function buildContinuousTrendPoints(
  rawPoints: Array<{ label: string; value: number }>,
  preset: DateRangePreset,
  customFrom?: string | null,
  customTo?: string | null,
): ContinuousTrendPoint[] {
  const valueMap = new Map<string, number>();
  for (const p of rawPoints) {
    valueMap.set(p.label, p.value);
  }

  if (preset === "today") {
    const isHourly =
      rawPoints.some(
        (p) => /^\d{1,2}$/.test(p.label) || /^\d{1,2}:00$/.test(p.label),
      ) || rawPoints.length > 1;

    if (isHourly) {
      return Array.from({ length: 24 }, (_, i) => {
        const hourStr = String(i).padStart(2, "0");
        const val =
          valueMap.get(hourStr) ??
          valueMap.get(String(i)) ??
          valueMap.get(`${hourStr}:00`) ??
          0;
        return {
          label: `${hourStr}:00`,
          displayLabel: hourStr,
          value: val,
        };
      });
    }
  }

  let start: Date;
  let end: Date;

  if (preset === "custom" && customFrom && customTo) {
    start = new Date(`${customFrom}T00:00:00`);
    end = new Date(`${customTo}T00:00:00`);
    if (start > end) {
      const tmp = start;
      start = end;
      end = tmp;
    }
  } else {
    const range = dateRangePresets(preset === "custom" ? "today" : preset);
    start = range.from;
    end = range.to;
  }

  const days = eachDayOfInterval({ start, end });
  return days.map((day) => {
    const isoKey = format(day, "yyyy-MM-dd");
    const value = valueMap.get(isoKey) ?? 0;

    let displayLabel: string;
    if (preset === "week") {
      displayLabel = format(day, "EEE"); // Mon, Tue, Wed, Thu, Fri, Sat, Sun
    } else if (preset === "month") {
      displayLabel = String(day.getDate()); // 1, 2, ..., 31
    } else if (preset === "last7") {
      displayLabel = format(day, "d/M");
    } else if (preset === "custom") {
      displayLabel = format(day, "d/M");
    } else {
      displayLabel = format(day, "dd MMM");
    }

    return {
      label: isoKey,
      displayLabel,
      value,
    };
  });
}

type TrendBarsProps = {
  points: Array<{ label: string; value: number }>;
  valueLabel?: string;
};

export function TrendBars({ points, valueLabel = "Amount" }: TrendBarsProps) {
  const max = Math.max(...points.map((point) => point.value), 0);

  if (!points.length) {
    return (
      <p className="text-sm text-muted-foreground">No data for this period.</p>
    );
  }

  return (
    <div className="space-y-3">
      {points.map((point) => {
        const width = max > 0 ? (point.value / max) * 100 : 0;
        return (
          <div key={point.label} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-muted-foreground">{point.label}</span>
              <span className="shrink-0 font-medium tabular-nums">
                {formatCurrency(point.value)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">{valueLabel}</p>
    </div>
  );
}
