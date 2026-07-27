"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { SkipToMain } from "@/components/layout/skip-to-main";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { getPageTitle } from "@/lib/auth/page-titles";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types/auth";

type TopbarProps = {
  onMenuClick: () => void;
};

export function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:px-6">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
      >
        <Menu />
      </Button>
      <h1 className="min-w-0 truncate text-[15px] font-bold tracking-tight text-foreground">
        {title}
      </h1>
    </header>
  );
}

type AppShellProps = {
  user: SessionUser;
  children: React.ReactNode;
};

export function AppShell({ user, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isBilling = pathname === "/billing" || pathname.startsWith("/billing/");

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <SkipToMain />
      <Sidebar
        user={user}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "min-h-0 w-full flex-1 overflow-y-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            isBilling ? "p-0" : "p-4 lg:p-6",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
