"use client";

import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  action?: ReactNode;
  className?: string;
};

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this page. Please try again.",
  onRetry,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center",
        className,
      )}
      role="alert"
    >
      <AlertCircle
        className="mb-4 size-12 text-destructive"
        strokeWidth={1.5}
        aria-hidden
      />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 flex items-center gap-2">
        {onRetry ? (
          <Button type="button" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
        {action}
      </div>
    </div>
  );
}
