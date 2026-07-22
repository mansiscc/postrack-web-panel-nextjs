"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createAccountAction,
  updateAccountAction,
} from "@/features/accounts/actions";
import {
  accountSchema,
  type AccountFormInput,
} from "@/features/accounts/schema";
import type { AccountListItem } from "@/features/accounts/types";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-120">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit account" : "Add account"}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-2">
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
                type="number"
                min={0}
                step="0.01"
                {...form.register("openingBalance")}
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
          </div>
          <SheetFooter className="border-t px-4 py-4">
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
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
