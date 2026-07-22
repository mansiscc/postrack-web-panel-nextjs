"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";

type FormSheetFooterProps = {
  onCancel: () => void;
  isSubmitting: boolean;
  submitLabel?: string;
  submittingLabel?: string;
};

export function FormSheetFooter({
  onCancel,
  isSubmitting,
  submitLabel = "Save",
  submittingLabel = "Saving…",
}: FormSheetFooterProps) {
  return (
    <SheetFooter className="border-t px-4 py-4">
      <Button type="button" variant="ghost" onClick={onCancel}>
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
    </SheetFooter>
  );
}
