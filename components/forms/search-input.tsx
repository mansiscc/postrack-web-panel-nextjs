"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  debounceMs?: number;
  onChange: (value: string) => void;
  className?: string;
};

export function SearchInput({
  value,
  defaultValue = "",
  placeholder = "Search…",
  debounceMs = 300,
  onChange,
  className,
}: SearchInputProps) {
  const [internal, setInternal] = useState(value ?? defaultValue);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (value !== undefined) setInternal(value);
  }, [value]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      onChangeRef.current(internal);
    }, debounceMs);
    return () => window.clearTimeout(handle);
  }, [internal, debounceMs]);

  return (
    <div className={cn("relative w-full max-w-70", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={internal}
        onChange={(event) => setInternal(event.target.value)}
        placeholder={placeholder}
        className="h-9.5 pr-8 pl-8 text-[13px]"
        aria-label={placeholder}
      />
      {internal ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-1/2 right-1.5 -translate-y-1/2"
          onClick={() => setInternal("")}
          aria-label="Clear search"
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}
