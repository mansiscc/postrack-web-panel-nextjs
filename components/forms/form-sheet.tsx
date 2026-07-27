"use client";

import type { ReactNode } from "react";

import {
  ModalCard,
  ModalCardBody,
  ModalCardContent,
  ModalCardHeader,
  ModalCardTitle,
  type ModalCardSize,
} from "@/components/ui/modal-card";

type FormModalCardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onSubmit: () => void;
  children: ReactNode;
  footer: ReactNode;
  size?: ModalCardSize;
};

/** Centered modal card for create/edit forms (viewport-height aware). */
export function FormModalCard({
  open,
  onOpenChange,
  title,
  onSubmit,
  children,
  footer,
  size = "lg",
}: FormModalCardProps) {
  return (
    <ModalCard open={open} onOpenChange={onOpenChange}>
      <ModalCardContent size={size} className="gap-0">
        <ModalCardHeader>
          <ModalCardTitle>{title}</ModalCardTitle>
        </ModalCardHeader>
        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <ModalCardBody className="space-y-3.5">{children}</ModalCardBody>
          {footer}
        </form>
      </ModalCardContent>
    </ModalCard>
  );
}

/** @deprecated Use FormModalCard — kept as alias during migration. */
export const FormSheet = FormModalCard;
