"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createProductAction,
  updateProductAction,
} from "@/hooks/features/products/actions";
import {
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from "@/hooks/features/products/schema";
import type { ProductListItem } from "@/hooks/features/products/types";
import { FormField } from "@/components/forms/form-field";
import { ImageUpload } from "@/components/forms/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ModalCard,
  ModalCardBody,
  ModalCardContent,
  ModalCardFooter,
  ModalCardHeader,
  ModalCardTitle,
} from "@/components/ui/modal-card";
import { Switch } from "@/components/ui/switch";

type CategoryOption = { id: string; name: string };

type ProductFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductListItem | null;
  categories: CategoryOption[];
  onSuccess: () => void;
};

const emptyValues: CreateProductInput = {
  name: "",
  barcode: "",
  purchasePrice: null,
  sellingPrice: null,
  mrp: null,
  unit: "",
  lowStockAlertQty: 0,
  productCategoryId: null,
  openingStock: 0,
  stockQuantity: 0,
  isActive: true,
  imageUrl: null,
};

export function ProductFormSheet({
  open,
  onOpenChange,
  product,
  categories,
  onSuccess,
}: ProductFormSheetProps) {
  const isEdit = Boolean(product);
  const form = useForm<CreateProductInput | UpdateProductInput>({
    resolver: zodResolver(isEdit ? updateProductSchema : createProductSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        product
          ? {
              name: product.name,
              barcode: product.barcode ?? "",
              purchasePrice: product.purchasePrice,
              sellingPrice: product.sellingPrice,
              mrp: product.mrp,
              unit: product.unit ?? "",
              lowStockAlertQty: product.lowStockAlertQty,
              productCategoryId: product.categoryId,
              stockQuantity: product.stockQuantity,
              isActive: product.isActive,
              imageUrl: product.imageUrl,
            }
          : emptyValues,
      );
    }
  }, [open, product, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const result = isEdit
      ? await updateProductAction(product!.id, values)
      : await createProductAction(values);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Product updated" : "Product created");
    onOpenChange(false);
    onSuccess();
  });

  return (
    <ModalCard open={open} onOpenChange={onOpenChange}>
      <ModalCardContent size="xl">
        <ModalCardHeader>
          <ModalCardTitle>
            {isEdit ? "Edit product" : "Add product"}
          </ModalCardTitle>
        </ModalCardHeader>
        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <ModalCardBody className="space-y-4">
            <FormField label="Image">
              <ImageUpload
                value={form.watch("imageUrl")}
                onChange={(url) => form.setValue("imageUrl", url)}
              />
            </FormField>

            <FormField
              label="Name"
              htmlFor="name"
              required
              error={form.formState.errors.name?.message}
            >
              <Input id="name" {...form.register("name")} />
            </FormField>

            <FormField
              label="Barcode"
              htmlFor="barcode"
              error={form.formState.errors.barcode?.message}
            >
              <Input id="barcode" {...form.register("barcode")} />
            </FormField>

            <FormField label="Category">
              <Select
                value={form.watch("productCategoryId") ?? "none"}
                onValueChange={(value) =>
                  form.setValue(
                    "productCategoryId",
                    value === "none" ? null : value,
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Purchase price" htmlFor="purchasePrice">
                <Input
                  id="purchasePrice"
                  type="number"
                  min={0}
                  step="0.01"
                  {...form.register("purchasePrice")}
                />
              </FormField>
              <FormField label="Selling price" htmlFor="sellingPrice">
                <Input
                  id="sellingPrice"
                  type="number"
                  min={0}
                  step="0.01"
                  {...form.register("sellingPrice")}
                />
              </FormField>
              <FormField label="MRP" htmlFor="mrp">
                <Input
                  id="mrp"
                  type="number"
                  min={0}
                  step="0.01"
                  {...form.register("mrp")}
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Unit" htmlFor="unit">
                <Input id="unit" placeholder="kg, pcs, box…" {...form.register("unit")} />
              </FormField>
              <FormField
                label="Low stock alert"
                htmlFor="lowStockAlertQty"
                error={form.formState.errors.lowStockAlertQty?.message}
              >
                <Input
                  id="lowStockAlertQty"
                  type="number"
                  min={0}
                  step="1"
                  {...form.register("lowStockAlertQty")}
                />
              </FormField>
            </div>

            {isEdit ? (
              <FormField
                label="Current stock"
                htmlFor="stockQuantity"
                error={
                  "stockQuantity" in form.formState.errors
                    ? form.formState.errors.stockQuantity?.message
                    : undefined
                }
              >
                <Input
                  id="stockQuantity"
                  type="number"
                  min={0}
                  step="1"
                  {...form.register("stockQuantity")}
                />
              </FormField>
            ) : (
              <FormField
                label="Opening stock"
                htmlFor="openingStock"
                error={
                  "openingStock" in form.formState.errors
                    ? form.formState.errors.openingStock?.message
                    : undefined
                }
              >
                <Input
                  id="openingStock"
                  type="number"
                  min={0}
                  step="1"
                  {...form.register("openingStock")}
                />
              </FormField>
            )}

            <FormField label="Active">
              <Switch
                checked={form.watch("isActive")}
                onCheckedChange={(checked) => form.setValue("isActive", checked)}
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
