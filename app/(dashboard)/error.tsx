"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/feedback/error-state";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Unable to load this page"
      description={
        error.message ||
        "An unexpected error occurred. Please try again or contact support if the problem persists."
      }
      onRetry={reset}
    />
  );
}
