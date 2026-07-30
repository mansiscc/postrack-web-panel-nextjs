"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchSuggestOption = {
  id: string;
  title: string;
  subtitle?: string;
};

type SearchSuggestFieldProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchSuggestOption[];
  onSelect: (option: SearchSuggestOption) => void;
  placeholder?: string;
  selectedId?: string | null;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  maxResults?: number;
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Input + suggestion list — same interaction pattern as POS billing customer fields.
 */
export function SearchSuggestField({
  value,
  onValueChange,
  options,
  onSelect,
  placeholder,
  selectedId = null,
  disabled = false,
  className,
  inputClassName,
  maxResults = 8,
}: SearchSuggestFieldProps) {
  const [focused, setFocused] = useState(false);
  const debouncedQuery = useDebouncedValue(value, 300);

  const results = useMemo(() => {
    const query = debouncedQuery.trim().toLowerCase();
    if (!query) return [];
    return options
      .filter(
        (option) =>
          option.title.toLowerCase().includes(query) ||
          (option.subtitle?.toLowerCase().includes(query) ?? false),
      )
      .slice(0, maxResults);
  }, [options, debouncedQuery, maxResults]);

  const showDropdown = focused && results.length > 0;

  return (
    <div className={cn("relative", className)}>
      <Input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        className={inputClassName}
        onChange={(event) => onValueChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          window.setTimeout(() => setFocused(false), 150);
        }}
        autoComplete="off"
      />
      {showDropdown ? (
        <div className="absolute top-full right-0 left-0 z-40 mt-1 overflow-hidden rounded-xl border border-border/60 bg-card shadow-card">
          <ul className="max-h-56 overflow-y-auto">
            {results.map((option, index) => (
              <li key={option.id}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(option);
                    setFocused(false);
                  }}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                    selectedId === option.id && "bg-primary-light/60",
                  )}
                >
                  <span className="text-sm font-medium">{option.title}</span>
                  {option.subtitle ? (
                    <span className="text-xs text-muted-foreground">
                      {option.subtitle}
                    </span>
                  ) : null}
                </button>
                {index < results.length - 1 ? (
                  <div className="mx-3 border-t border-border/60" />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
