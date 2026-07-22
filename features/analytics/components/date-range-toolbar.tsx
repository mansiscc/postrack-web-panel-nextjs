"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DateRangePreset } from "@/utils/date";

type DateRangeToolbarProps = {
  showExport?: boolean;
  onExport?: () => void;
};

const PRESETS: Array<{ id: DateRangePreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "last7", label: "Last 7 days" },
  { id: "custom", label: "Custom" },
];

export function DateRangeToolbar({
  showExport = false,
  onExport,
}: DateRangeToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const preset = (searchParams.get("preset") as DateRangePreset) || "today";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    startTransition(() => {
      router.replace(`?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((item) => (
        <Button
          key={item.id}
          type="button"
          size="sm"
          variant={preset === item.id ? "default" : "outline"}
          disabled={isPending}
          onClick={() =>
            updateParams({
              preset: item.id,
              from: item.id === "custom" ? from || null : null,
              to: item.id === "custom" ? to || null : null,
            })
          }
        >
          {item.label}
        </Button>
      ))}
      {preset === "custom" && (
        <>
          <Input
            type="date"
            value={from}
            onChange={(event) =>
              updateParams({ preset: "custom", from: event.target.value })
            }
            className="w-40"
            aria-label="From date"
          />
          <Input
            type="date"
            value={to}
            onChange={(event) =>
              updateParams({ preset: "custom", to: event.target.value })
            }
            className="w-40"
            aria-label="To date"
          />
        </>
      )}
      {showExport && onExport && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={onExport}
        >
          Export CSV
        </Button>
      )}
    </div>
  );
}
