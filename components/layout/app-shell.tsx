"use client";

import { Bell, Menu } from "lucide-react";
import { useState } from "react";

import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";
import { SkipToMain } from "@/components/layout/skip-to-main";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SessionUser } from "@/types/auth";

type TopbarProps = {
  user: SessionUser;
  onMenuClick: () => void;
};

export function Topbar({ user, onMenuClick }: TopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
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
        <BreadcrumbNav />
      </div>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled
              aria-label="Notifications"
            >
              <Bell />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Coming soon</TooltipContent>
        </Tooltip>
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {user.companyName}
        </span>
      </div>
    </header>
  );
}

type AppShellProps = {
  user: SessionUser;
  children: React.ReactNode;
};

export function AppShell({ user, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <SkipToMain />
      <Sidebar
        user={user}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} onMenuClick={() => setMobileOpen(true)} />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-360 flex-1 p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:p-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
