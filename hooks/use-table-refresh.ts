"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

/** Soft-refresh server data after mutations (replaces full page reload). */
export function useTableRefresh() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  return useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);
}
