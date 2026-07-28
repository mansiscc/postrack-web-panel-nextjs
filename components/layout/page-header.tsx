import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  /** Kept for call-site compatibility; title is shown in the topbar. */
  title?: string;
  actions?: ReactNode;
  className?: string;
};

/**
 * Page chrome under the topbar — actions only.
 * Page title lives in the sticky topbar.
 */
export function PageHeader({ actions, className }: PageHeaderProps) {
  if (!actions) return null;

  return (
    <div
      className={cn(
        "mb-3.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-end",
        className,
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}
