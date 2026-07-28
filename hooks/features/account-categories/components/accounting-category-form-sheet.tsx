"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createAccountingCategoryAction,
  updateAccountingCategoryAction,
} from "@/hooks/features/account-categories/actions";
import {
  accountingCategorySchema,
  type AccountingCategoryFormInput,
} from "@/hooks/features/account-categories/schema";
import type { AccountingCategoryListItem } from "@/hooks/features/account-categories/types";
import { FormField } from "@/components/forms/form-field";
import { CategoryTypeSelector } from "@/components/forms/category-type-selector";
import { FormSheetFooter } from "@/components/forms/form-sheet-footer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ModalCard,
  ModalCardBody,
  ModalCardContent,
  ModalCardHeader,
  ModalCardTitle,
} from "@/components/ui/modal-card";

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

    toast.success(isEdit ? "Category updated" : "Category added");
    onOpenChange(false);
    onSuccess();
  });

  return (
    <ModalCard open={open} onOpenChange={onOpenChange}>
      <ModalCardContent size="lg">
        <ModalCardHeader>
          <ModalCardTitle>
            {isEdit ? "Edit Category" : "Add Category"}
          </ModalCardTitle>
        </ModalCardHeader>
        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <ModalCardBody className="space-y-4">
            {category?.isSystem ? (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Name and type cannot be changed for system categories.
              </p>
            ) : null}
            <FormField
              label="Category Name"
              htmlFor="name"
              required
              error={form.formState.errors.name?.message}
            >
              <Input
                id="name"
                placeholder="Enter category name"
                {...form.register("name")}
                disabled={Boolean(category?.isSystem && isEdit)}
              />
            </FormField>
            <FormField
              label="Category Type"
              required
              error={form.formState.errors.type?.message}
            >
              <CategoryTypeSelector
                value={form.watch("type")}
                onChange={(value) => form.setValue("type", value)}
                disabled={Boolean(category?.isSystem && isEdit)}
              />
            </FormField>
            <FormField
              label="Description"
              htmlFor="description"
              error={form.formState.errors.description?.message}
            >
              <Textarea
                id="description"
                rows={3}
                placeholder="Enter description (optional)"
                {...form.register("description")}
              />
            </FormField>
          </ModalCardBody>
          <FormSheetFooter
            onCancel={() => onOpenChange(false)}
            isSubmitting={form.formState.isSubmitting}
            submitLabel={isEdit ? "Update" : "Add Category"}
          />
        </form>
      </ModalCardContent>
    </ModalCard>
  );
}
