import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  /** Kept for call-site compatibility; title is shown in the topbar. */
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

/**
 * Page chrome under the topbar — description + actions only.
 * Page title lives in the sticky topbar.
 */
export function PageHeader({
  description,
  actions,
  className,
}: PageHeaderProps) {
  if (!description && !actions) return null;

  return (
    <div
      className={cn(
        "mb-3.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {description ? (
        <p className="min-w-0 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : (
        <div className="min-w-0 flex-1" />
      )}
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
