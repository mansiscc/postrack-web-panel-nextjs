"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createAccountAction,
  updateAccountAction,
} from "@/hooks/features/accounts/actions";
import {
  accountSchema,
  type AccountFormInput,
} from "@/hooks/features/accounts/schema";
import type { AccountListItem } from "@/hooks/features/accounts/types";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { bindDecimalInput } from "@/lib/validation/rhf";
import {
  ModalCard,
  ModalCardBody,
  ModalCardContent,
  ModalCardFooter,
  ModalCardHeader,
  ModalCardTitle,
} from "@/components/ui/modal-card";

type AccountFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: AccountListItem | null;
  onSuccess: () => void;
};

export function AccountFormSheet({
  open,
  onOpenChange,
  account,
  onSuccess,
}: AccountFormSheetProps) {
  const isEdit = Boolean(account);
  const form = useForm<AccountFormInput>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      description: "",
      openingBalance: 0,
      isActive: true,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: account?.name ?? "",
        description: account?.description ?? "",
        openingBalance: account?.openingBalance ?? 0,
        isActive: account?.isActive ?? true,
      });
    }
  }, [open, account, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const result = isEdit
      ? await updateAccountAction(account!.id, values)
      : await createAccountAction(values);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Account updated" : "Account created");
    onOpenChange(false);
    onSuccess();
  });

  return (
    <ModalCard open={open} onOpenChange={onOpenChange}>
      <ModalCardContent size="lg">
        <ModalCardHeader>
          <ModalCardTitle>
            {isEdit ? "Edit account" : "Add account"}
          </ModalCardTitle>
        </ModalCardHeader>
        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <ModalCardBody className="space-y-4">
            <FormField
              label="Name"
              htmlFor="name"
              required
              error={form.formState.errors.name?.message}
            >
              <Input id="name" {...form.register("name")} />
            </FormField>
            <FormField
              label="Description"
              htmlFor="description"
              error={form.formState.errors.description?.message}
            >
              <Textarea
                id="description"
                rows={3}
                {...form.register("description")}
              />
            </FormField>
            <FormField
              label="Opening balance"
              htmlFor="openingBalance"
              required
              error={form.formState.errors.openingBalance?.message}
            >
              <Input
                id="openingBalance"
                {...bindDecimalInput(form, "openingBalance", {
                  placeholder: "0.00",
                })}
              />
            </FormField>
            {isEdit && account && (
              <FormField label="Current balance">
                <p className="text-sm font-medium tabular-nums">
                  {account.currentBalance.toFixed(2)}
                </p>
              </FormField>
            )}
            <FormField label="Active">
              <Switch
                checked={form.watch("isActive")}
                onCheckedChange={(checked) =>
                  form.setValue("isActive", checked)
                }
              />
            </FormField>
          </ModalCardBody>
          <ModalCardFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </ModalCardFooter>
        </form>
      </ModalCardContent>
    </ModalCard>
  );
}
