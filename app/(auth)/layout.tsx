import type { Metadata } from "next";

import { SkipToMain } from "@/components/layout/skip-to-main";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <SkipToMain />
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
          <div>
            <p className="text-2xl font-bold tracking-tight">POSTrack</p>
            <p className="mt-2 text-sm text-primary-foreground/80">
              POS &amp; inventory management for modern retail
            </p>
          </div>
          <p className="text-sm text-primary-foreground/70">
            Desktop-first admin console for store operations, billing, and
            inventory.
          </p>
        </div>
        <main
          id="main-content"
          tabIndex={-1}
          className="flex items-center justify-center p-6 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
