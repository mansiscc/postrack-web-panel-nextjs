"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createSupplierAction,
  updateSupplierAction,
} from "@/features/suppliers/actions";
import {
  supplierSchema,
  type SupplierFormInput,
} from "@/features/suppliers/schema";
import type { SupplierListItem } from "@/features/suppliers/types";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type SupplierFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: SupplierListItem | null;
  onSuccess: () => void;
};

const emptyValues: SupplierFormInput = {
  supplierName: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  gstNumber: "",
  openingBalance: 0,
};

export function SupplierFormSheet({
  open,
  onOpenChange,
  supplier,
  onSuccess,
}: SupplierFormSheetProps) {
  const isEdit = Boolean(supplier);
  const form = useForm<SupplierFormInput>({
    resolver: zodResolver(supplierSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        supplier
          ? {
              supplierName: supplier.supplierName,
              contactPerson: supplier.contactPerson ?? "",
              phone: supplier.phone ?? "",
              email: supplier.email ?? "",
              address: supplier.address ?? "",
              gstNumber: supplier.gstNumber ?? "",
              openingBalance: supplier.openingBalance ?? 0,
            }
          : emptyValues,
      );
    }
  }, [open, supplier, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const result = isEdit
      ? await updateSupplierAction(supplier!.id, values)
      : await createSupplierAction(values);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Supplier updated" : "Supplier created");
    onOpenChange(false);
    onSuccess();
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-120">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit supplier" : "Add supplier"}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-2">
            <FormField
              label="Supplier name"
              htmlFor="supplierName"
              required
              error={form.formState.errors.supplierName?.message}
            >
              <Input id="supplierName" {...form.register("supplierName")} />
            </FormField>
            <FormField label="Contact person" htmlFor="contactPerson">
              <Input id="contactPerson" {...form.register("contactPerson")} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Phone" htmlFor="phone">
                <Input id="phone" {...form.register("phone")} />
              </FormField>
              <FormField
                label="Email"
                htmlFor="email"
                error={form.formState.errors.email?.message}
              >
                <Input id="email" type="email" {...form.register("email")} />
              </FormField>
            </div>
            <FormField label="GST number" htmlFor="gstNumber">
              <Input id="gstNumber" {...form.register("gstNumber")} />
            </FormField>
            <FormField label="Address" htmlFor="address">
              <Textarea id="address" rows={3} {...form.register("address")} />
            </FormField>
            <FormField label="Opening balance" htmlFor="openingBalance">
              <Input
                id="openingBalance"
                type="number"
                step="0.01"
                {...form.register("openingBalance")}
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
