"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  checkDuplicateProductNameAction,
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
import type { DuplicateProductMatch } from "@/repositories/products.repository";
import { FormField } from "@/components/forms/form-field";
import { FormSheetFooter } from "@/components/forms/form-sheet-footer";
import { ImageUpload } from "@/components/forms/image-upload";
import { SearchSuggestField } from "@/components/forms/search-suggest-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatCurrency, formatNumber } from "@/utils/currency";

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

function DuplicateMatchItem({ match }: { match: DuplicateProductMatch }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-2.5 text-foreground shadow-xs space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-sm leading-snug text-foreground">
          {match.name}
        </div>
        {match.categoryName && (
          <span className="text-[11px] rounded-md bg-muted px-2 py-0.5 text-muted-foreground font-medium shrink-0">
            {match.categoryName}
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <span>Barcode:</span>
        <span className="font-mono font-medium text-foreground">
          {match.barcode || "—"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-xs">
        <div className="bg-surface-variant rounded-md p-1.5 text-center">
          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
            Selling
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {match.sellingPrice != null ? formatCurrency(match.sellingPrice) : "—"}
          </span>
        </div>
        <div className="bg-surface-variant rounded-md p-1.5 text-center">
          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
            MRP
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {match.mrp != null ? formatCurrency(match.mrp) : "—"}
          </span>
        </div>
        <div className="bg-surface-variant rounded-md p-1.5 text-center">
          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
            Stock
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatNumber(match.stockQuantity)} {match.unit || "Pcs"}
          </span>
        </div>
      </div>
    </div>
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
  const [duplicateMatches, setDuplicateMatches] = useState<
    DuplicateProductMatch[]
  >([]);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);

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
      setDuplicateMatches([]);
      setIsCheckingDuplicate(false);
      setDuplicateAcknowledged(false);
      setIsDuplicateDialogOpen(false);
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
      setDuplicateMatches([]);
      setIsCheckingDuplicate(false);
      setDuplicateAcknowledged(false);
      setIsDuplicateDialogOpen(false);
    }
  }, [open, product, categories, form]);

  const watchedName = form.watch("name");

  // Real-time debounced duplicate product name search
  useEffect(() => {
    if (!open) {
      setDuplicateMatches([]);
      setIsCheckingDuplicate(false);
      setDuplicateAcknowledged(false);
      return;
    }

    setDuplicateAcknowledged(false);
    const trimmed = (watchedName || "").trim();
    if (trimmed.length < 3) {
      setDuplicateMatches([]);
      setIsCheckingDuplicate(false);
      return;
    }

    // In edit mode, if name is unchanged, skip duplicate check
    if (
      isEdit &&
      product &&
      trimmed.toLowerCase() === product.name.trim().toLowerCase()
    ) {
      setDuplicateMatches([]);
      setIsCheckingDuplicate(false);
      return;
    }

    let cancelled = false;
    setIsCheckingDuplicate(true);

    const timer = setTimeout(async () => {
      try {
        const result = await checkDuplicateProductNameAction(
          trimmed,
          product?.id,
        );
        if (!cancelled) {
          if (result.success) {
            setDuplicateMatches(result.data);
          } else {
            setDuplicateMatches([]);
          }
        }
      } catch {
        if (!cancelled) {
          setDuplicateMatches([]);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingDuplicate(false);
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, watchedName, isEdit, product]);

  const performSave = async (
    values: CreateProductInput | UpdateProductInput,
  ) => {
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
  };

  const onSubmit = form.handleSubmit(async (values) => {
    // If duplicate matches exist and user hasn't confirmed yet, show confirmation dialog
    if (duplicateMatches.length > 0 && !duplicateAcknowledged) {
      setIsDuplicateDialogOpen(true);
      return;
    }

    await performSave(values);
  });

  const handleConfirmDuplicateDialog = () => {
    setDuplicateAcknowledged(true);
    setIsDuplicateDialogOpen(false);
    void form.handleSubmit((values) => performSave(values))();
  };

  const selectedCategoryId = form.watch("productCategoryId") ?? null;
  const unitValue = getUnitSelectValue(form.watch("unit"));
  const unitOptions =
    !UNIT_OPTIONS.includes(unitValue as (typeof UNIT_OPTIONS)[number])
      ? [...UNIT_OPTIONS, unitValue]
      : [...UNIT_OPTIONS];

  return (
    <>
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
                      <div className="relative">
                        <Input
                          id="name"
                          placeholder="Enter product name"
                          {...form.register("name")}
                          className={cn(
                            duplicateMatches.length > 0 &&
                            "border-warning focus-visible:ring-warning/20",
                          )}
                        />
                        {isCheckingDuplicate && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-muted-foreground pointer-events-none">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                          </div>
                        )}
                      </div>
                    </FormField>

                    {isCheckingDuplicate && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground -mt-2 px-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                        <span>Checking existing products…</span>
                      </div>
                    )}

                    {!isCheckingDuplicate && duplicateMatches.length > 0 && (
                      <div className="rounded-xl border border-warning/40 bg-warning-muted/40 p-3 text-warning-foreground space-y-2.5 -mt-2 animate-in fade-in-0 duration-200">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-warning-icon">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                          <span>A product with this name already exists:</span>
                        </div>
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {duplicateMatches.slice(0, 3).map((match) => (
                            <DuplicateMatchItem key={match.id} match={match} />
                          ))}
                        </div>
                      </div>
                    )}

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
                          form.setValue(
                            "unit",
                            normalizeUnit(value) || DEFAULT_UNIT,
                          )
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

      {/* Duplicate Product Name Confirmation Dialog - Exact match with POS-Billing-System app */}
      <Dialog
        open={isDuplicateDialogOpen}
        onOpenChange={(openDialog) => {
          if (!openDialog) setIsDuplicateDialogOpen(false);
        }}
      >
        <DialogContent className="max-w-md gap-4">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              Product name already exists
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {duplicateMatches.slice(0, 5).map((match) => (
              <DuplicateMatchItem key={match.id} match={match} />
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDuplicateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDuplicateDialog}
              disabled={form.formState.isSubmitting}
            >
              Save Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
