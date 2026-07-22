"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createAccountingCategoryAction,
  updateAccountingCategoryAction,
} from "@/features/account-categories/actions";
import {
  accountingCategorySchema,
  type AccountingCategoryFormInput,
} from "@/features/account-categories/schema";
import type { AccountingCategoryListItem } from "@/features/account-categories/types";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type AccountingCategoryFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: AccountingCategoryListItem | null;
  onSuccess: () => void;
};

export function AccountingCategoryFormSheet({
  open,
  onOpenChange,
  category,
  onSuccess,
}: AccountingCategoryFormSheetProps) {
  const isEdit = Boolean(category);
  const form = useForm<AccountingCategoryFormInput>({
    resolver: zodResolver(accountingCategorySchema),
    defaultValues: {
      name: "",
      type: "income",
      description: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: category?.name ?? "",
        type: category?.type ?? "income",
        description: category?.description ?? "",
        isActive: category?.isActive ?? true,
      });
    }
  }, [open, category, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const result = isEdit
      ? await updateAccountingCategoryAction(category!.id, values)
      : await createAccountingCategoryAction(values);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Category updated" : "Category created");
    onOpenChange(false);
    onSuccess();
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-120">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Edit account category" : "Add account category"}
          </SheetTitle>
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
              label="Type"
              required
              error={form.formState.errors.type?.message}
            >
              <Select
                value={form.watch("type")}
                onValueChange={(value: "income" | "expense") =>
                  form.setValue("type", value)
                }
                disabled={isEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
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
