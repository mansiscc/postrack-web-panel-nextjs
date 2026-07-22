"use client";

import type { ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type FormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onSubmit: () => void;
  children: ReactNode;
  footer: ReactNode;
};

export function FormSheet({
  open,
  onOpenChange,
  title,
  onSubmit,
  children,
  footer,
}: FormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-120">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-2">
            {children}
          </div>
          {footer}
        </form>
      </SheetContent>
    </Sheet>
  );
}
