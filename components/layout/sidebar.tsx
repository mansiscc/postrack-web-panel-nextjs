"use client";

import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { logoutAction } from "@/hooks/features/auth/actions";
import { getNavGroupsForUser, type NavItem } from "@/lib/auth/navigation";
import type { SessionUser } from "@/types/auth";
import { canAccessModule } from "@/utils/permissions";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/use-media-query";

type SidebarProps = {
  user: SessionUser;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

const ROLE_BADGE: Record<
  SessionUser["role"],
  { label: string; className: string }
> = {
  Admin: { label: "Admin", className: "bg-primary/10 text-primary" },
  Manager: { label: "Manager", className: "bg-info/15 text-info" },
  Staff: { label: "Staff", className: "bg-muted text-muted-foreground" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: NavItem["icon"];
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors duration-150",
        active
          ? "bg-accent text-primary before:absolute before:top-1 before:bottom-1 before:left-0 before:w-0.75 before:rounded-full before:bg-primary"
          : "text-foreground hover:bg-accent/80",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-5 shrink-0" strokeWidth={1.75} />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

export function Sidebar({ user, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [collapsed, setCollapsed] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const navGroups = getNavGroupsForUser(user);
  const roleBadge = ROLE_BADGE[user.role];

  useEffect(() => {
    if (!isDesktop) {
      setCollapsed(false);
      return;
    }
    const stored = localStorage.getItem("postrack.sidebarCollapsed");
    if (stored === "true") setCollapsed(true);
  }, [isDesktop]);

  useEffect(() => {
    if (isDesktop) {
      localStorage.setItem("postrack.sidebarCollapsed", String(collapsed));
    }
  }, [collapsed, isDesktop]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setCollapsed((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-sidebar-border px-4",
          collapsed && "justify-center px-2",
        )}
      >
        <div className={cn("min-w-0 flex-1", collapsed && "flex-none")}>
          <p className="text-[13px] font-bold tracking-tight text-primary">
            POSTrack
          </p>
          {!collapsed ? (
            <p className="truncate text-[11px] text-muted-foreground">
              {user.companyName}
            </p>
          ) : null}
        </div>
        {isDesktop ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn("shrink-0", collapsed && "mt-0")}
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </Button>
        ) : null}
      </div>

      <nav
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-2 py-3"
        aria-label="Main navigation"
      >
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed ? (
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {group.label}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={isActive(item.href)}
                  collapsed={collapsed && isDesktop}
                  onNavigate={onMobileClose}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border bg-sidebar p-3">
        <div
          className={cn(
            "flex items-center gap-1",
            collapsed && isDesktop && "flex-col",
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-3 rounded-md p-2 text-left hover:bg-accent/80",
                  collapsed && isDesktop && "flex-none justify-center",
                )}
              >
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {getInitials(user.fullName)}
                  </AvatarFallback>
                </Avatar>
                {!collapsed || !isDesktop ? (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {user.fullName}
                    </p>
                    <Badge
                      variant="secondary"
                      className={cn("mt-0.5 text-xs", roleBadge.className)}
                    >
                      {roleBadge.label}
                    </Badge>
                  </div>
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{user.fullName}</p>
                  <p className="text-xs font-normal text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {canAccessModule(
                user.role,
                user.permissions,
                "business-profile",
              ) ? (
                <DropdownMenuItem asChild>
                  <Link href="/settings/business-profile">
                    Business profile
                  </Link>
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          {collapsed && isDesktop ? (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setLogoutConfirmOpen(true)}
                  aria-label="Log out"
                >
                  <LogOut />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Log out</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => setLogoutConfirmOpen(true)}
              aria-label="Log out"
            >
              <LogOut />
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
        title="Log out?"
        description="You will be signed out of your account. You can sign back in anytime."
        confirmLabel="Log out"
        destructive
        onConfirm={() => {
          void logoutAction();
        }}
      />
    </div>
  );

  if (!isDesktop) {
    return (
      <>
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden",
            mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={onMobileClose}
          aria-hidden
        />
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar shadow-lg transition-transform duration-300 ease-in-out lg:hidden",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {sidebarContent}
        </aside>
      </>
    );
  }

  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 flex-col border-r border-sidebar-border transition-[width] duration-300 ease-in-out lg:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {sidebarContent}
    </aside>
  );
}
