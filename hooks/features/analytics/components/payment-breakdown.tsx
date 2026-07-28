import { formatCurrency } from "@/utils/currency";
import { cn } from "@/lib/utils";

type PaymentBreakdownProps = {
  cash: number;
  upi: number;
  card: number;
  /** Android PaymentSection subtitle */
  description?: string;
  /** Android EmptyHint when total is zero */
  emptyMessage?: string;
  className?: string;
  /** Larger chart for dashboard tall section */
  chartVariant?: "default" | "dashboard";
};

type Segment = {
  label: string;
  value: number;
  color: string;
};

const VIEW_SIZE = 132;
const STROKE_WIDTH = 20;
const EMPTY_RING_COLOR = "#D1D5DB";

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeStrokeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const sweep = endAngle - startAngle;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function DonutChart({
  segments,
  total,
}: {
  segments: Segment[];
  total: number;
}) {
  const cx = VIEW_SIZE / 2;
  const cy = VIEW_SIZE / 2;
  const radius = (VIEW_SIZE - STROKE_WIDTH) / 2;
  const activeSegments = segments.filter((segment) => segment.value > 0);

  if (total <= 0) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={EMPTY_RING_COLOR}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
      />
    );
  }

  if (activeSegments.length === 1) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={activeSegments[0].color}
        strokeWidth={STROKE_WIDTH}
      />
    );
  }

  const segmentTotal = activeSegments.reduce((sum, segment) => sum + segment.value, 0);
  let startAngle = 0;

  return (
    <>
      {activeSegments.map((segment) => {
        const sweep = (segment.value / segmentTotal) * 360;
        const endAngle = startAngle + sweep;
        const path = describeStrokeArc(cx, cy, radius, startAngle, endAngle);
        startAngle = endAngle;
        return (
          <path
            key={segment.label}
            d={path}
            fill="none"
            stroke={segment.color}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="butt"
          />
        );
      })}
    </>
  );
}

export function PaymentBreakdown({
  cash,
  upi,
  card,
  description,
  emptyMessage = "No collections on today's bills",
  className,
  chartVariant = "default",
}: PaymentBreakdownProps) {
  const total = cash + upi + card;
  const isDashboard = chartVariant === "dashboard";
  const segments: Segment[] = [
    { label: "Cash", value: cash, color: "#F59E0B" },
    { label: "UPI", value: upi, color: "#10B981" },
    { label: "Card", value: card, color: "#6366F1" },
  ];
  const totalForPercent = Math.max(total, 1);

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <div
          className={cn(
            "flex min-h-0 items-center",
            isDashboard ? "h-full gap-5 lg:gap-6" : "gap-3",
          )}
        >
          {/* Donut — nudged right on dashboard */}
          <div
            className={cn(
              "relative flex shrink-0 items-center justify-center",
              isDashboard
                ? "ml-3 h-full min-h-45 w-[min(46%,280px)] lg:ml-5 lg:min-h-65 lg:w-[min(48%,300px)]"
                : "size-33",
            )}
          >
            <svg
              viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
              aria-hidden
              className={cn(
                "block aspect-square",
                isDashboard ? "h-full max-h-full w-auto max-w-full" : "size-full",
              )}
            >
              <DonutChart segments={segments} total={total} />
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-2 text-center">
              <span
                className={cn(
                  "text-muted-foreground",
                  isDashboard ? "text-xs lg:text-[13px]" : "text-[10px]",
                )}
              >
                Split
              </span>
              <span
                className={cn(
                  "max-w-full truncate font-bold tabular-nums text-foreground",
                  isDashboard ? "text-base lg:text-lg" : "text-[12px]",
                )}
              >
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {/* Description + legend — beside chart, nudged right */}
          <div
            className={cn(
              "min-w-0 flex-1",
              isDashboard ? "ml-1 space-y-3 pl-2 lg:ml-2 lg:space-y-4 lg:pl-3" : "space-y-2.5",
            )}
          >
            {description && isDashboard ? (
              <p className="text-[12px] leading-snug text-muted-foreground lg:text-[13px]">
                {description}
              </p>
            ) : null}

            {segments.map((segment) => {
              const percent = Math.round((segment.value / totalForPercent) * 100);
              return (
                <div key={segment.label} className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "shrink-0 rounded-full",
                      isDashboard ? "size-3.5" : "size-2.5",
                    )}
                    style={{ backgroundColor: segment.color }}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate font-medium text-foreground",
                      isDashboard ? "text-sm lg:text-[15px]" : "text-[12px]",
                    )}
                  >
                    {segment.label}
                  </span>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "font-semibold tabular-nums text-foreground",
                        isDashboard ? "text-sm lg:text-[15px]" : "text-[12px]",
                      )}
                    >
                      {formatCurrency(segment.value)}
                    </p>
                    <p
                      className={cn(
                        "tabular-nums text-muted-foreground",
                        isDashboard ? "text-xs lg:text-[13px]" : "text-[10px]",
                      )}
                    >
                      {total > 0 ? `${percent}%` : "0%"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {description && !isDashboard ? (
          <p className="mt-2 shrink-0 text-[10px] leading-snug text-muted-foreground">
            {description}
          </p>
        ) : null}

        {total <= 0 ? (
          <div className="mt-2 shrink-0 rounded-md bg-surface-variant px-2.5 py-2">
            <p
              className={cn(
                "text-muted-foreground",
                isDashboard ? "text-[13px]" : "text-[11px]",
              )}
            >
              {emptyMessage}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
