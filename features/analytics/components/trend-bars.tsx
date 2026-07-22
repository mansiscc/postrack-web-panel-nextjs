import { formatCurrency } from "@/utils/currency";

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
