"use client";

import { cn } from "@/lib/utils";

type CategoryType = "income" | "expense";

type CategoryTypeSelectorProps = {
  value: CategoryType;
  onChange: (value: CategoryType) => void;
  disabled?: boolean;
  className?: string;
};

const OPTIONS: { value: CategoryType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

const SELECTED_STYLES: Record<CategoryType, string> = {
  expense: "bg-destructive-muted text-destructive",
  income: "bg-success-muted text-success-icon",
};

export function CategoryTypeSelector({
  value,
  onChange,
  disabled,
  className,
}: CategoryTypeSelectorProps) {
  return (
    <div
      className={cn(
        "flex gap-1 rounded-md bg-surface-variant p-1",
        className,
      )}
      role="group"
      aria-label="Category type"
    >
      {OPTIONS.map((option) => {
        const selected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex flex-1 items-center justify-center rounded-full px-3 py-2 text-[11px] font-semibold tracking-wide transition-colors",
              selected
                ? SELECTED_STYLES[option.value]
                : "bg-card text-muted-foreground hover:text-foreground",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
