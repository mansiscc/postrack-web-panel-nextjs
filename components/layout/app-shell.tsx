"use client";

import { ArrowLeft, Menu, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { SkipToMain } from "@/components/layout/skip-to-main";
import { Sidebar } from "@/components/layout/sidebar";
import {
  TopbarChromeProvider,
  useTopbarChrome,
} from "@/components/layout/topbar-chrome";
import { Button } from "@/components/ui/button";
import { getPageTitle } from "@/lib/auth/page-titles";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types/auth";

function DashboardRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
      Refresh
    </Button>
  );
}

function isProductDetailPath(pathname: string) {
  if (!pathname.startsWith("/products/")) return false;
  const id = pathname.slice("/products/".length).split("/")[0];
  return Boolean(id) && id !== "new";
}

function isSalesDetailPath(pathname: string) {
  if (!pathname.startsWith("/sales/")) return false;
  const [id, nested] = pathname.slice("/sales/".length).split("/");
  return Boolean(id) && !nested;
}

function isSupplierDetailPath(pathname: string) {
  if (!pathname.startsWith("/suppliers/")) return false;
  const id = pathname.slice("/suppliers/".length).split("/")[0];
  return Boolean(id);
}

function isAccountDetailPath(pathname: string) {
  if (!pathname.startsWith("/accounts/")) return false;
  const id = pathname.slice("/accounts/".length).split("/")[0];
  return Boolean(id);
}

type TopbarProps = {
  onMenuClick: () => void;
};

export function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const { chrome } = useTopbarChrome();
  const fallbackTitle = getPageTitle(pathname);
  const title = chrome.title?.trim() || fallbackTitle;
  const isDashboard = pathname === "/";
  const showDetailBack =
    isProductDetailPath(pathname) ||
    isSalesDetailPath(pathname) ||
    isSupplierDetailPath(pathname) ||
    isAccountDetailPath(pathname);
  const detailBackHref = isSalesDetailPath(pathname)
    ? "/sales"
    : isSupplierDetailPath(pathname)
      ? "/suppliers"
      : isAccountDetailPath(pathname)
        ? "/accounts"
      : "/products";

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-card px-4 shadow-card-sm lg:gap-3 lg:px-6">
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

      {chrome.leading ? (
        <div className="flex shrink-0 items-center">{chrome.leading}</div>
      ) : showDetailBack ? (
        <Button type="button" variant="ghost" size="icon-sm" asChild>
          <Link href={detailBackHref} aria-label="Back">
            <ArrowLeft />
          </Link>
        </Button>
      ) : null}

      <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold leading-normal tracking-tight text-foreground">
        {title}
      </h1>

      {chrome.actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {chrome.actions}
        </div>
      ) : null}

      {!chrome.actions && isDashboard ? <DashboardRefreshButton /> : null}
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
    <TopbarChromeProvider>
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
    </TopbarChromeProvider>
  );
}
