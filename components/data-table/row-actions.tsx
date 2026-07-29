"use client";

import { KeyRound, Pencil, RotateCcw, Trash2 } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RowActionsProps = {
  onEdit?: () => void;
  editDisabled?: boolean;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  onRestore?: () => void;
  onPassword?: () => void;
  passwordDisabled?: boolean;
  children?: ReactNode;
  className?: string;
};

function stopRowClick(event: MouseEvent) {
  event.stopPropagation();
}

function shouldShowAction(
  handler: (() => void) | undefined,
  disabled: boolean | undefined,
) {
  return handler !== undefined || disabled === true;
}

export function RowActions({
  onEdit,
  editDisabled,
  onDelete,
  deleteDisabled,
  onRestore,
  onPassword,
  passwordDisabled,
  children,
  className,
}: RowActionsProps) {
  return (
    <div
      data-row-action
      className={cn("flex items-center justify-end gap-0.5", className)}
      onClick={stopRowClick}
    >
      {shouldShowAction(onEdit, editDisabled) ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Edit"
          disabled={editDisabled}
          className={cn(editDisabled && "opacity-50")}
          onClick={onEdit}
        >
          <Pencil />
        </Button>
      ) : null}
      {shouldShowAction(onPassword, passwordDisabled) ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Change password"
          disabled={passwordDisabled}
          className={cn(passwordDisabled && "opacity-50")}
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
      {shouldShowAction(onDelete, deleteDisabled) ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Delete"
          disabled={deleteDisabled}
          className={cn(
            "text-destructive hover:bg-destructive/10 hover:text-destructive",
            deleteDisabled && "opacity-50",
          )}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      ) : null}
      {children}
    </div>
  );
}
