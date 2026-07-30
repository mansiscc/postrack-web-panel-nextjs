import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SkeletonClassProps = {
  className?: string;
};

function ToolbarSkeleton({
  filters = 2,
  showAction = true,
}: {
  filters?: number;
  showAction?: boolean;
}) {
  return (
    <div className="mb-3.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
        <Skeleton className="h-9 w-full max-w-xs" />
        {Array.from({ length: filters }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-28" />
        ))}
      </div>
      {showAction ? <Skeleton className="h-9 w-32 shrink-0" /> : null}
    </div>
  );
}

function TableRowsSkeleton({
  rows = 8,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  const widths = ["w-[22%]", "w-[18%]", "w-[16%]", "w-[14%]", "w-16"];

  return (
    <div className="overflow-hidden rounded-lg bg-card shadow-card">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-4">
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton
              key={index}
              className={cn("h-3.5", widths[index % widths.length])}
            />
          ))}
        </div>
      </div>
      <div className="divide-y divide-border/60">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="flex items-center gap-4 px-4 py-3.5"
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                className={cn(
                  "h-4",
                  widths[colIndex % widths.length],
                  colIndex === columns - 1 && "ml-auto",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiGridSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2",
        count >= 4 && "xl:grid-cols-4",
        count === 3 && "xl:grid-cols-3",
        count === 6 && "lg:grid-cols-3 xl:grid-cols-6",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex min-h-24 items-center gap-3.5 rounded-lg bg-card px-4 py-4 shadow-card"
        >
          <Skeleton className="size-10 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionCardSkeleton({
  className,
  bodyClassName,
}: {
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-52 flex-col overflow-hidden rounded-lg bg-card shadow-card",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-border/40 px-3.5 py-3">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className={cn("flex flex-1 flex-col gap-3 p-3", bodyClassName)}>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="mt-auto h-24 w-full" />
      </div>
    </div>
  );
}

/** Default list pages: toolbar + table (title lives in the topbar). */
export function ListPageSkeleton({
  rows = 8,
  filters = 2,
  columns = 4,
  className,
}: SkeletonClassProps & {
  rows?: number;
  filters?: number;
  columns?: number;
}) {
  return (
    <div className={cn("space-y-0", className)} aria-busy="true" aria-live="polite">
      <ToolbarSkeleton filters={filters} />
      <TableRowsSkeleton rows={rows} columns={columns} />
    </div>
  );
}

/** Dashboard home: KPI tiles + section cards. */
export function DashboardPageSkeleton({ className }: SkeletonClassProps) {
  return (
    <div className={cn("space-y-4", className)} aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-28" />
      </div>
      <KpiGridSkeleton count={4} />
      <div className="grid gap-3.5 lg:grid-cols-2">
        <SectionCardSkeleton />
        <SectionCardSkeleton />
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg bg-card p-3.5 shadow-card"
          >
            <Skeleton className="mb-3 size-8 rounded-md" />
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Analytics pages: date toolbar + KPIs + chart cards. */
export function AnalyticsPageSkeleton({ className }: SkeletonClassProps) {
  return (
    <div className={cn("space-y-3.5", className)} aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-20 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <KpiGridSkeleton count={4} />
      <div className="grid gap-3.5 lg:grid-cols-2">
        <SectionCardSkeleton />
        <SectionCardSkeleton />
      </div>
      <div className="grid gap-3.5 lg:grid-cols-2">
        <SectionCardSkeleton />
        <SectionCardSkeleton />
      </div>
    </div>
  );
}

/** Detail pages: identity hero + metric grid + content sections. */
export function DetailPageSkeleton({
  metrics = 4,
  className,
}: SkeletonClassProps & { metrics?: number }) {
  return (
    <div className={cn("w-full space-y-4", className)} aria-busy="true" aria-live="polite">
      <div className="rounded-lg bg-card p-4 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Skeleton className="size-20 shrink-0 rounded-lg sm:size-24" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <Skeleton className="h-6 w-48 sm:w-64" />
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3.5 w-28" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <KpiGridSkeleton count={metrics} />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCardSkeleton />
        <SectionCardSkeleton />
      </div>
    </div>
  );
}

/** Transactions / KPI+table pages. */
export function TransactionsPageSkeleton({ className }: SkeletonClassProps) {
  return (
    <div className={cn("space-y-3.5", className)} aria-busy="true" aria-live="polite">
      <KpiGridSkeleton count={3} />
      <ListPageSkeleton rows={7} filters={4} columns={5} />
    </div>
  );
}

/** Inventory overview. */
export function InventoryPageSkeleton({ className }: SkeletonClassProps) {
  return (
    <div className={cn("space-y-4 lg:space-y-5", className)} aria-busy="true" aria-live="polite">
      <div className="rounded-lg bg-card p-4 shadow-card sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-56" />
          </div>
          <Skeleton className="h-10 w-24 rounded-full" />
        </div>
        <Skeleton className="mt-4 h-2.5 w-full rounded-full" />
      </div>
      <KpiGridSkeleton count={4} />
      <div className="grid gap-3.5 lg:grid-cols-3">
        <SectionCardSkeleton />
        <SectionCardSkeleton />
        <SectionCardSkeleton />
      </div>
    </div>
  );
}

/** POS billing workspace. */
export function BillingPageSkeleton({ className }: SkeletonClassProps) {
  return (
    <div
      className={cn(
        "flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col bg-surface-variant xl:flex-row",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
    >
      <section className="hidden min-h-0 w-[20%] shrink-0 flex-col border-r border-border/60 bg-card p-3 xl:flex">
        <Skeleton className="mb-3 h-10 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col bg-card p-3 xl:border-r xl:border-border/60">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-lg border border-border/50 p-3"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </section>

      <section className="hidden min-h-0 w-[28%] shrink-0 flex-col bg-card p-3 xl:flex">
        <Skeleton className="mb-3 h-10 w-full" />
        <Skeleton className="mb-3 h-10 w-full" />
        <div className="mt-auto space-y-3 border-t border-border/50 pt-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </section>
    </div>
  );
}

/** Settings / form pages. */
export function FormPageSkeleton({ className }: SkeletonClassProps) {
  return (
    <div className={cn("mx-auto max-w-3xl space-y-4", className)} aria-busy="true" aria-live="polite">
      <div className="rounded-lg bg-card p-4 shadow-card sm:p-5">
        <Skeleton className="mb-4 h-5 w-40" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
    </div>
  );
}

/** Back-compat alias used by the dashboard segment loading fallback. */
export function PageSkeleton({
  rows = 8,
  className,
}: SkeletonClassProps & { rows?: number }) {
  return <ListPageSkeleton rows={rows} className={className} />;
}
