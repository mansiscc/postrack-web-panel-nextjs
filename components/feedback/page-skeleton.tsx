import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PageSkeletonProps = {
  rows?: number;
  className?: string;
};

export function PageSkeleton({ rows = 8, className }: PageSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)} aria-busy="true">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-hidden rounded-[inherit]">
          <div className="border-b border-border px-4 py-3">
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: rows }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/5" />
                <Skeleton className="h-4 w-1/6" />
                <Skeleton className="ml-auto h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
