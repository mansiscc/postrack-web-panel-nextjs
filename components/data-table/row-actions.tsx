"use client";

import { KeyRound, Pencil, RotateCcw, Trash2 } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RowActionsProps = {
  onEdit?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onPassword?: () => void;
  children?: ReactNode;
  className?: string;
};

function stopRowClick(event: MouseEvent) {
  event.stopPropagation();
}

export function RowActions({
  onEdit,
  onDelete,
  onRestore,
  onPassword,
  children,
  className,
}: RowActionsProps) {
  return (
    <div
      data-row-action
      className={cn("flex items-center justify-end gap-0.5", className)}
      onClick={stopRowClick}
    >
      {onEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Edit"
          onClick={onEdit}
        >
          <Pencil />
        </Button>
      ) : null}
      {onPassword ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Change password"
          onClick={onPassword}
        >
          <KeyRound />
        </Button>
      ) : null}
      {onRestore ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Restore"
          onClick={onRestore}
        >
          <RotateCcw />
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Delete"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      ) : null}
      {children}
    </div>
  );
}
