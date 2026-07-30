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
import { PostrackLogo } from "@/components/brand/postrack-logo";
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
  Admin: { label: "Admin", className: "bg-primary-muted text-primary" },
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
        "relative flex min-h-9 items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium leading-normal transition-colors duration-150",
        active
          ? "bg-primary-muted text-primary before:absolute before:top-1 before:bottom-1 before:left-0 before:w-0.75 before:rounded-full before:bg-primary"
          : "text-foreground hover:bg-primary-muted/70",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-5 shrink-0" strokeWidth={1.75} />
      {!collapsed ? <span className="truncate leading-normal">{label}</span> : null}
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

  const isCollapsedDesktop = collapsed && isDesktop;

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-sidebar-border px-4",
          isCollapsedDesktop && "justify-center px-2",
        )}
      >
        {isCollapsedDesktop ? (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                aria-label="Expand sidebar"
                className="group relative flex size-9 items-center justify-center rounded-md hover:bg-accent/80"
              >
                <PostrackLogo
                  size={28}
                  className="group-hover:invisible"
                  priority
                />
                <ChevronRight className="pointer-events-none absolute size-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <PostrackLogo size={32} priority />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold leading-normal tracking-tight text-primary">
                  POSTrack
                </p>
                <p className="truncate text-[11px] leading-normal text-muted-foreground">
                  {user.companyName}
                </p>
              </div>
            </div>
            {isDesktop ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse sidebar"
              >
                <ChevronLeft />
              </Button>
            ) : null}
          </>
        )}
      </div>

      <nav
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-2 py-3"
        aria-label="Main navigation"
      >
        {navGroups.map((group) => (
          <div key={group.label}>
            {!isCollapsedDesktop ? (
              <p className="px-3 pb-1 text-[11px] font-semibold leading-normal tracking-wider text-muted-foreground uppercase">
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
                  collapsed={isCollapsedDesktop}
                  onNavigate={onMobileClose}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div
        className={cn(
          "shrink-0 border-t border-sidebar-border bg-sidebar",
          isCollapsedDesktop ? "p-2" : "p-3",
        )}
      >
        {isCollapsedDesktop ? (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setLogoutConfirmOpen(true)}
                aria-label="Log out"
                className="group relative mx-auto flex size-9 items-center justify-center rounded-md hover:bg-accent/80"
              >
                <Avatar className="size-8 group-hover:invisible">
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {getInitials(user.fullName)}
                  </AvatarFallback>
                </Avatar>
                <LogOut className="pointer-events-none absolute size-4 text-destructive opacity-0 group-hover:opacity-100" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Log out</TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-2 text-left hover:bg-accent/80"
                >
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/10 text-xs text-primary">
                      {getInitials(user.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-normal">
                      {user.fullName}
                    </p>
                    <Badge
                      variant="secondary"
                      className={cn("mt-0.5 text-xs", roleBadge.className)}
                    >
                      {roleBadge.label}
                    </Badge>
                  </div>
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
          </div>
        )}
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
            "fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-sidebar-border/80 bg-sidebar shadow-overlay transition-transform duration-300 ease-in-out lg:hidden",
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
        "hidden h-full shrink-0 flex-col border-r border-sidebar-border/80 bg-sidebar shadow-card-sm transition-[width] duration-300 ease-in-out lg:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {sidebarContent}
    </aside>
  );
}
