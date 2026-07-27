"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ModalCardSize = "md" | "lg" | "xl" | "2xl";

const sizeClasses: Record<ModalCardSize, string> = {
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
  "2xl": "max-w-5xl",
};

function ModalCard({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="modal-card" {...props} />;
}

function ModalCardTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return (
    <DialogPrimitive.Trigger data-slot="modal-card-trigger" {...props} />
  );
}

function ModalCardClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="modal-card-close" {...props} />;
}

function ModalCardPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="modal-card-portal" {...props} />;
}

function ModalCardOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="modal-card-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/40 duration-100 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function ModalCardContent({
  className,
  children,
  size = "lg",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  size?: ModalCardSize;
  showCloseButton?: boolean;
}) {
  return (
    <ModalCardPortal>
      <ModalCardOverlay />
      <DialogPrimitive.Content
        data-slot="modal-card-content"
        className={cn(
          // Viewport-filling card shell (matches sibling admin modals)
          "fixed top-1/2 left-1/2 z-50 flex min-h-0 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card p-0 text-sm text-card-foreground shadow-xl outline-none",
          "max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)]",
          "duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close data-slot="modal-card-close" asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-3 right-3 z-10"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </ModalCardPortal>
  );
}

function ModalCardHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="modal-card-header"
      className={cn(
        "shrink-0 border-b border-border bg-muted/40 px-5 py-4 pr-12",
        className,
      )}
      {...props}
    />
  );
}

function ModalCardTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="modal-card-title"
      className={cn(
        "font-heading text-[15px] leading-snug font-bold tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

function ModalCardDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="modal-card-description"
      className={cn("mt-1 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function ModalCardBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="modal-card-body"
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 scrollbar-gutter-stable",
        className,
      )}
      {...props}
    />
  );
}

function ModalCardFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="modal-card-footer"
      className={cn(
        "mt-auto flex shrink-0 flex-row items-center justify-end gap-2 border-t border-border bg-card px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}

export {
  ModalCard,
  ModalCardBody,
  ModalCardClose,
  ModalCardContent,
  ModalCardDescription,
  ModalCardFooter,
  ModalCardHeader,
  ModalCardOverlay,
  ModalCardPortal,
  ModalCardTitle,
  ModalCardTrigger,
  type ModalCardSize,
};
