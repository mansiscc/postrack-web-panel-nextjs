"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createCategoryAction,
  updateCategoryAction,
} from "@/hooks/features/categories/actions";
import {
  categorySchema,
  type CategoryFormInput,
} from "@/hooks/features/categories/schema";
import type { CategoryListItem } from "@/hooks/features/categories/types";
import { FormSheet } from "@/components/forms/form-sheet";
import { FormSheetFooter } from "@/components/forms/form-sheet-footer";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type CategoryFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: CategoryListItem | null;
  onSuccess: () => void;
};

export function CategoryFormSheet({
  open,
  onOpenChange,
  category,
  onSuccess,
}: CategoryFormSheetProps) {
  const isEdit = Boolean(category);
  const form = useForm<CategoryFormInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      description: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: category?.name ?? "",
        description: category?.description ?? "",
        isActive: category?.isActive ?? true,
      });
    }
  }, [open, category, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const result = isEdit
      ? await updateCategoryAction(category!.id, values)
      : await createCategoryAction(values);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Category updated" : "Category created");
    onOpenChange(false);
    onSuccess();
  });

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit category" : "Add category"}
      onSubmit={onSubmit}
      footer={
        <FormSheetFooter
          onCancel={() => onOpenChange(false)}
          isSubmitting={form.formState.isSubmitting}
        />
      }
    >
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
        <Textarea id="description" rows={3} {...form.register("description")} />
      </FormField>
      <FormField label="Active">
        <Switch
          checked={form.watch("isActive")}
          onCheckedChange={(checked) => form.setValue("isActive", checked)}
        />
      </FormField>
    </FormSheet>
  );
}
