import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl border border-border bg-muted/60">
          <Icon
            className="size-5 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
      ) : null}
      <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
