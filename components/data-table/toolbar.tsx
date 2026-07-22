import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DataTableToolbarProps = {
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function DataTableToolbar({
  children,
  actions,
  className,
}: DataTableToolbarProps) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {children}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
