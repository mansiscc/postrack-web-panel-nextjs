"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { changeUserPasswordAction } from "@/features/users/actions";
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/features/users/schema";
import { FormField } from "@/components/forms/form-field";
import { FormModalCardFooter } from "@/components/forms/form-sheet-footer";
import { Input } from "@/components/ui/input";
import {
  ModalCard,
  ModalCardBody,
  ModalCardContent,
  ModalCardDescription,
  ModalCardHeader,
  ModalCardTitle,
} from "@/components/ui/modal-card";

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
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      userId: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (open && userId) {
      form.reset({
        userId,
        newPassword: "",
        confirmPassword: "",
      });
    }
  }, [open, userId, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await changeUserPasswordAction(values);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Password updated successfully");
    onOpenChange(false);
  });

  return (
    <ModalCard open={open} onOpenChange={onOpenChange}>
      <ModalCardContent size="md">
        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <ModalCardHeader>
            <ModalCardTitle>Change Password</ModalCardTitle>
            {userName ? (
              <ModalCardDescription>
                Change password for {userName}
              </ModalCardDescription>
            ) : null}
          </ModalCardHeader>

          <ModalCardBody className="space-y-4">
            <FormField
              label="New Password"
              htmlFor="newPassword"
              required
              error={form.formState.errors.newPassword?.message}
            >
              <Input
                id="newPassword"
                type="password"
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
                {...form.register("newPassword")}
              />
            </FormField>
            <FormField
              label="Confirm Password"
              htmlFor="confirmPassword"
              required
              error={form.formState.errors.confirmPassword?.message}
            >
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter password"
                autoComplete="new-password"
                {...form.register("confirmPassword")}
              />
            </FormField>
          </ModalCardBody>

          <FormModalCardFooter
            onCancel={() => onOpenChange(false)}
            isSubmitting={form.formState.isSubmitting}
            submitLabel="Update Password"
            submittingLabel="Saving…"
          />
        </form>
      </ModalCardContent>
    </ModalCard>
  );
}
