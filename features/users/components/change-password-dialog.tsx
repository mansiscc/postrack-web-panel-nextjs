"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { changeUserPasswordAction } from "@/features/users/actions";
import { changePasswordSchema } from "@/features/users/schema";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ChangePasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName?: string;
};

export function ChangePasswordDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: ChangePasswordDialogProps) {
  const form = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { userId: "", newPassword: "" },
  });

  useEffect(() => {
    if (open && userId) {
      form.reset({ userId, newPassword: "" });
    }
  }, [open, userId, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await changeUserPasswordAction(values);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Password updated");
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {userName ? (
            <p className="text-sm text-muted-foreground">
              Set a new password for {userName}.
            </p>
          ) : null}
          <FormField
            label="New password"
            required
            error={form.formState.errors.newPassword?.message}
          >
            <Input type="password" {...form.register("newPassword")} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Update password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
