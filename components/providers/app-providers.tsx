"use client";

import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      {children}
      <Toaster richColors closeButton position="bottom-right" />
    </TooltipProvider>
  );
}
