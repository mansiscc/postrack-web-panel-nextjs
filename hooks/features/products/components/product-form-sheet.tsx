"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, type ReactNode } from "react";
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
import { FormSheetFooter } from "@/components/forms/form-sheet-footer";
import { ImageUpload } from "@/components/forms/image-upload";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  bindBarcodeInput,
  bindDecimalInput,
  bindIntegerInput,
} from "@/lib/validation/rhf";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  ModalCard,
  ModalCardBody,
  ModalCardContent,
  ModalCardHeader,
  ModalCardTitle,
} from "@/components/ui/modal-card";

type CategoryOption = { id: string; name: string };

type ProductFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductListItem | null;
  categories: CategoryOption[];
  onSuccess: () => void;
};

const UNIT_OPTIONS = ["Kg", "Gms", "Pcs", "Ltr", "Ml"] as const;

function normalizeUnit(unit: string | null | undefined) {
  if (!unit?.trim()) return "";
  const trimmed = unit.trim();
  const match = UNIT_OPTIONS.find(
    (option) => option.toLowerCase() === trimmed.toLowerCase(),
  );
  return match ?? trimmed;
}

function getUnitSelectValue(unit: string | null | undefined) {
  const normalized = normalizeUnit(unit);
  return normalized || "none";
}

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

function ProductSectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <CardHeader className="border-b border-border/60 pb-3 pt-4">
        <CardTitle className="text-sm font-bold text-primary">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4 pb-4">{children}</CardContent>
    </Card>
  );
}

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
              unit: normalizeUnit(product.unit),
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

    toast.success("Product saved successfully");
    onOpenChange(false);
    onSuccess();
  });

  const unitValue = getUnitSelectValue(form.watch("unit"));
  const unitOptions =
    unitValue !== "none" &&
    !UNIT_OPTIONS.includes(unitValue as (typeof UNIT_OPTIONS)[number])
      ? [...UNIT_OPTIONS, unitValue]
      : [...UNIT_OPTIONS];

  return (
    <ModalCard open={open} onOpenChange={onOpenChange}>
      <ModalCardContent size="2xl">
        <ModalCardHeader>
          <ModalCardTitle>
            {isEdit ? "Edit Product" : "Add Product"}
          </ModalCardTitle>
        </ModalCardHeader>
        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <ModalCardBody className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)] xl:items-start">
              <ProductSectionCard title="Product Image">
                <ImageUpload
                  value={form.watch("imageUrl")}
                  onChange={(url) => form.setValue("imageUrl", url)}
                  emptyLabel="No image selected"
                  chooseLabel="Choose Image"
                  changeLabel="Change Image"
                  removeLabel="Remove Image"
                  helpText="Pick one image for this product. It will be stored securely in the cloud."
                />
              </ProductSectionCard>

              <div className="grid gap-4">
                <ProductSectionCard title="Basic Information">
                  <FormField
                    label="Product Name"
                    htmlFor="name"
                    required
                    error={form.formState.errors.name?.message}
                  >
                    <Input
                      id="name"
                      placeholder="Enter product name"
                      {...form.register("name")}
                    />
                  </FormField>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Category" className="min-w-0">
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
                          <SelectValue placeholder="Select Category (Optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            Select Category (Optional)
                          </SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>

                    <FormField
                      label="Barcode"
                      htmlFor="barcode"
                      className="min-w-0"
                      error={form.formState.errors.barcode?.message}
                    >
                      <Input
                        id="barcode"
                        {...bindBarcodeInput(form, "barcode", {
                          placeholder: "Barcode (optional)",
                        })}
                      />
                    </FormField>
                  </div>
                </ProductSectionCard>

                <ProductSectionCard title="Pricing">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField label="Purchase Price" htmlFor="purchasePrice">
                      <Input
                        id="purchasePrice"
                        {...bindDecimalInput(form, "purchasePrice", {
                          placeholder: "e.g. 20.50",
                        })}
                      />
                    </FormField>
                    <FormField
                      label="Selling Price"
                      htmlFor="sellingPrice"
                      required
                      error={form.formState.errors.sellingPrice?.message}
                    >
                      <Input
                        id="sellingPrice"
                        {...bindDecimalInput(form, "sellingPrice", {
                          placeholder: "e.g. 25.00",
                        })}
                      />
                    </FormField>
                    <FormField
                      label="MRP"
                      htmlFor="mrp"
                      required
                      error={form.formState.errors.mrp?.message}
                    >
                      <Input
                        id="mrp"
                        {...bindDecimalInput(form, "mrp", {
                          placeholder: "e.g. 30.00",
                        })}
                      />
                    </FormField>
                  </div>
                </ProductSectionCard>
              </div>
            </div>

            <div
              className={cn(
                "grid gap-4",
                isEdit &&
                  "xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)] xl:items-start",
              )}
            >
              {isEdit ? (
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-card px-4 py-4 shadow-card">
                  <Label className="text-sm font-medium">Active</Label>
                  <Switch
                    checked={form.watch("isActive")}
                    onCheckedChange={(checked) =>
                      form.setValue("isActive", checked)
                    }
                  />
                </div>
              ) : null}

              <ProductSectionCard
                title="Inventory"
                className={cn(!isEdit && "col-span-full")}
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {!isEdit ? (
                    <FormField
                      label="Opening Stock"
                      htmlFor="openingStock"
                      error={
                        "openingStock" in form.formState.errors
                          ? form.formState.errors.openingStock?.message
                          : undefined
                      }
                    >
                      <Input
                        id="openingStock"
                        {...bindIntegerInput(form, "openingStock", {
                          placeholder: "e.g. 50",
                        })}
                      />
                    </FormField>
                  ) : null}

                  <FormField
                    label="Low Stock Alert Quantity"
                    htmlFor="lowStockAlertQty"
                    error={form.formState.errors.lowStockAlertQty?.message}
                  >
                    <Input
                      id="lowStockAlertQty"
                      {...bindIntegerInput(form, "lowStockAlertQty", {
                        placeholder: "e.g. 5",
                      })}
                    />
                  </FormField>

                  <FormField label="Unit" required className="min-w-0">
                    <Select
                      value={unitValue}
                      onValueChange={(value) =>
                        form.setValue(
                          "unit",
                          value === "none" ? "" : normalizeUnit(value),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select unit</SelectItem>
                        {unitOptions.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
              </ProductSectionCard>
            </div>
          </ModalCardBody>
          <FormSheetFooter
            onCancel={() => onOpenChange(false)}
            isSubmitting={form.formState.isSubmitting}
            submitLabel={isEdit ? "Update Product" : "Save Product"}
            submittingLabel="Saving…"
          />
        </form>
      </ModalCardContent>
    </ModalCard>
  );
}
