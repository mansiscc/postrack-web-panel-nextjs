"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { SearchSuggestField } from "@/components/forms/search-suggest-field";
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
import {
  deleteStoredImage,
  isRemoteImageUrl,
  resolveImageUrlForSave,
} from "@/lib/uploads/client-image";
import { createId } from "@/utils/id";

type CategoryOption = { id: string; name: string };

type ProductFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductListItem | null;
  categories: CategoryOption[];
  onSuccess: () => void;
};

const UNIT_OPTIONS = ["Kg", "Gms", "Pcs", "Ltr", "Ml"] as const;
const DEFAULT_UNIT = "Pcs";

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
  return normalized || DEFAULT_UNIT;
}

const emptyValues: CreateProductInput = {
  name: "",
  barcode: "",
  purchasePrice: null,
  sellingPrice: null,
  mrp: null,
  unit: DEFAULT_UNIT,
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
  const [categoryQuery, setCategoryQuery] = useState("");
  /** Local file preview only — uploaded on Save (Android content:// pattern). */
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  /** Stable id for Cloudinary path on create (Android generates UUID before upload). */
  const [draftProductId, setDraftProductId] = useState(() => createId());
  const form = useForm<CreateProductInput | UpdateProductInput>({
    resolver: zodResolver(isEdit ? updateProductSchema : createProductSchema),
    defaultValues: emptyValues,
  });

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        id: category.id,
        title: category.name,
      })),
    [categories],
  );

  const uploadProductId = product?.id ?? draftProductId;
  const previousRemoteImageUrl = isRemoteImageUrl(product?.imageUrl)
    ? product!.imageUrl
    : null;

  useEffect(() => {
    if (open) {
      const categoryId = product?.categoryId ?? null;
      const categoryName =
        categories.find((category) => category.id === categoryId)?.name ?? "";

      if (!product) {
        setDraftProductId(createId());
      }

      setPendingImageFile(null);
      form.reset(
        product
          ? {
              name: product.name,
              barcode: product.barcode ?? "",
              purchasePrice: product.purchasePrice,
              sellingPrice: product.sellingPrice,
              mrp: product.mrp,
              unit: normalizeUnit(product.unit) || DEFAULT_UNIT,
              lowStockAlertQty: product.lowStockAlertQty,
              productCategoryId: categoryId,
              stockQuantity: product.stockQuantity,
              isActive: product.isActive,
              imageUrl: product.imageUrl,
            }
          : emptyValues,
      );
      setCategoryQuery(categoryName);
    } else {
      setPendingImageFile(null);
    }
  }, [open, product, categories, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    let imageUrl: string | null;
    try {
      imageUrl = await resolveImageUrlForSave({
        pendingFile: pendingImageFile,
        currentUrl: values.imageUrl,
        kind: "product_image",
        productId: uploadProductId,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Image upload failed",
      );
      return;
    }

    const payload = { ...values, imageUrl };
    const result = isEdit
      ? await updateProductAction(product!.id, payload)
      : await createProductAction({ ...payload, id: draftProductId });

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    // Match Android: delete Cloudinary asset only after DB clear on save.
    if (previousRemoteImageUrl && !imageUrl) {
      void deleteStoredImage({
        kind: "product_image",
        productId: uploadProductId,
      });
    }

    setPendingImageFile(null);
    toast.success("Product saved successfully");
    onOpenChange(false);
    onSuccess();
  });

  const selectedCategoryId = form.watch("productCategoryId") ?? null;
  const unitValue = getUnitSelectValue(form.watch("unit"));
  const unitOptions =
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
                  kind="product_image"
                  productId={uploadProductId}
                  value={form.watch("imageUrl")}
                  onChange={(url) => form.setValue("imageUrl", url)}
                  onPendingFileChange={setPendingImageFile}
                  emptyLabel="No image selected"
                  chooseLabel="Choose Image"
                  changeLabel="Change Image"
                  removeLabel="Remove Image"
                  helpText="Choose an image to preview. It uploads when you save the product."
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
                      <SearchSuggestField
                        value={categoryQuery}
                        selectedId={selectedCategoryId}
                        options={categoryOptions}
                        placeholder="Search category (optional)"
                        onValueChange={(query) => {
                          setCategoryQuery(query);
                          const selected = categories.find(
                            (category) => category.id === selectedCategoryId,
                          );
                          if (selected && selected.name !== query) {
                            form.setValue("productCategoryId", null);
                          }
                        }}
                        onSelect={(option) => {
                          form.setValue("productCategoryId", option.id);
                          setCategoryQuery(option.title);
                        }}
                      />
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
                        form.setValue("unit", normalizeUnit(value) || DEFAULT_UNIT)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
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
