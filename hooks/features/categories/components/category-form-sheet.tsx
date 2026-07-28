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
import { FormField } from "@/components/forms/form-field";
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
