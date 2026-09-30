"use client";

import { KeyRound, Pencil, RotateCcw, Trash2 } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type RowActionsProps = {
  onEdit?: () => void;
  editDisabled?: boolean;
  editTooltip?: string;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  deleteTooltip?: string;
  onRestore?: () => void;
  restoreTooltip?: string;
  onPassword?: () => void;
  passwordDisabled?: boolean;
  passwordTooltip?: string;
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

function ActionButtonTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export function RowActions({
  onEdit,
  editDisabled,
  editTooltip = "Edit",
  onDelete,
  deleteDisabled,
  deleteTooltip = "Delete",
  onRestore,
  restoreTooltip = "Restore",
  onPassword,
  passwordDisabled,
  passwordTooltip = "Change password",
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
        <ActionButtonTooltip label={editTooltip}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={editTooltip}
            disabled={editDisabled}
            className={cn(editDisabled && "opacity-50")}
            onClick={onEdit}
          >
            <Pencil />
          </Button>
        </ActionButtonTooltip>
      ) : null}
      {shouldShowAction(onPassword, passwordDisabled) ? (
        <ActionButtonTooltip label={passwordTooltip}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={passwordTooltip}
            disabled={passwordDisabled}
            className={cn(passwordDisabled && "opacity-50")}
            onClick={onPassword}
          >
            <KeyRound />
          </Button>
        </ActionButtonTooltip>
      ) : null}
      {onRestore ? (
        <ActionButtonTooltip label={restoreTooltip}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={restoreTooltip}
            onClick={onRestore}
          >
            <RotateCcw />
          </Button>
        </ActionButtonTooltip>
      ) : null}
      {shouldShowAction(onDelete, deleteDisabled) ? (
        <ActionButtonTooltip label={deleteTooltip}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={deleteTooltip}
            disabled={deleteDisabled}
            className={cn(
              "text-destructive hover:bg-destructive/10 hover:text-destructive",
              deleteDisabled && "opacity-50",
            )}
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </ActionButtonTooltip>
      ) : null}
      {children}
    </div>
  );
}
