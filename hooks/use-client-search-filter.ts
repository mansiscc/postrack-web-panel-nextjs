"use client";

import { useMemo, useState } from "react";

import type { ActiveStatusFilter } from "@/types/list-params";

type UseClientSearchFilterOptions<T> = {
  items: T[];
  getSearchableText: (item: T) => string;
  getIsActive?: (item: T) => boolean;
  initialStatus?: ActiveStatusFilter;
};

export function useClientSearchFilter<T>({
  items,
  getSearchableText,
  getIsActive,
  initialStatus = "all",
}: UseClientSearchFilterOptions<T>) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ActiveStatusFilter>(initialStatus);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !term || getSearchableText(item).toLowerCase().includes(term);
      const matchesStatus =
        status === "all" ||
        !getIsActive ||
        (status === "active" && getIsActive(item)) ||
        (status === "inactive" && !getIsActive(item));
      return matchesSearch && matchesStatus;
    });
  }, [items, search, status, getSearchableText, getIsActive]);

  return {
    search,
    setSearch,
    status,
    setStatus,
    filtered,
  };
}
