"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ModalCardFooter } from "@/components/ui/modal-card";

type FormModalCardFooterProps = {
  onCancel: () => void;
  isSubmitting: boolean;
  submitLabel?: string;
  submittingLabel?: string;
};

export function FormModalCardFooter({
  onCancel,
  isSubmitting,
  submitLabel = "Save",
  submittingLabel = "Saving…",
}: FormModalCardFooterProps) {
  return (
    <ModalCardFooter>
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            {submittingLabel}
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </ModalCardFooter>
  );
}

/** @deprecated Use FormModalCardFooter — kept as alias during migration. */
export const FormSheetFooter = FormModalCardFooter;
