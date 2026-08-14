"use client";

import { Download, Printer } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DateRangePreset } from "@/utils/date";

type DateRangeToolbarProps = {
  showExport?: boolean;
  onExport?: () => void;
  showPrint?: boolean;
  onPrint?: () => void;
  printPending?: boolean;
  /** Selected segment color — primary (sales) or success/green (purchases, like the app). */
  accent?: "primary" | "success";
};

/** Matches Android AnalyticsDateFilter: Today / This Week / This Month / Custom */
const PRESETS: Array<{ id: DateRangePreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "custom", label: "Custom" },
];

export function DateRangeToolbar({
  showExport = false,
  onExport,
  showPrint = false,
  onPrint,
  printPending = false,
  accent = "primary",
}: DateRangeToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const rawPreset = (searchParams.get("preset") as DateRangePreset) || "today";
  // Legacy "last7" is not in the app — treat as This Week
  const preset: DateRangePreset =
    rawPreset === "last7" ? "week" : rawPreset;
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
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-3">
        {/* Segmented control — same pattern as Android AnalyticsDateFilterBar */}
        <div
          role="tablist"
          aria-label="Date range"
          className="grid min-w-0 flex-1 grid-cols-4 gap-1 rounded-xl bg-card p-1 shadow-card-sm sm:max-w-xl"
        >
          {PRESETS.map((item) => {
            const selected = preset === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                disabled={isPending}
                onClick={() =>
                  updateParams({
                    preset: item.id,
                    from: item.id === "custom" ? from || null : null,
                    to: item.id === "custom" ? to || null : null,
                  })
                }
                className={cn(
                  "rounded-lg px-3 py-2 text-[12px] font-medium transition-colors",
                  selected
                    ? cn(
                        "font-semibold text-white shadow-sm",
                        accent === "success" ? "bg-success" : "bg-primary",
                      )
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  isPending && "opacity-60",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {showExport || showPrint ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {showPrint && onPrint ? (
              <Button
                type="button"
                variant="outline"
                disabled={printPending}
                onClick={onPrint}
              >
                <Printer className="h-4 w-4" />
                {printPending ? "Printing…" : "Print"}
              </Button>
            ) : null}
            {showExport && onExport ? (
              <Button type="button" variant="outline" onClick={onExport}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {preset === "custom" ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              From
            </span>
            <Input
              type="date"
              value={from}
              onChange={(event) =>
                updateParams({ preset: "custom", from: event.target.value })
              }
              className="h-9 w-40"
              aria-label="From date"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">To</span>
            <Input
              type="date"
              value={to}
              onChange={(event) =>
                updateParams({ preset: "custom", to: event.target.value })
              }
              className="h-9 w-40"
              aria-label="To date"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
