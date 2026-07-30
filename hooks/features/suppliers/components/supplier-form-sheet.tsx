"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createSupplierAction,
  updateSupplierAction,
} from "@/hooks/features/suppliers/actions";
import {
  supplierSchema,
  type SupplierFormInput,
} from "@/hooks/features/suppliers/schema";
import type { SupplierListItem } from "@/hooks/features/suppliers/types";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  bindEmailInput,
  bindGstinInput,
  bindPhoneInput,
} from "@/lib/validation/rhf";
import {
  ModalCard,
  ModalCardBody,
  ModalCardContent,
  ModalCardFooter,
  ModalCardHeader,
  ModalCardTitle,
} from "@/components/ui/modal-card";

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
    const payload = {
      ...values,
      openingBalance: isEdit
        ? (supplier?.openingBalance ?? values.openingBalance ?? 0)
        : 0,
    };

    const result = isEdit
      ? await updateSupplierAction(supplier!.id, payload)
      : await createSupplierAction(payload);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(
      isEdit
        ? "Supplier updated successfully"
        : "Supplier saved successfully",
    );
    onOpenChange(false);
    onSuccess();
  });

  return (
    <ModalCard open={open} onOpenChange={onOpenChange}>
      <ModalCardContent size="lg">
        <ModalCardHeader>
          <ModalCardTitle>
            {isEdit ? "Edit Supplier" : "Add Supplier"}
          </ModalCardTitle>
        </ModalCardHeader>
        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <ModalCardBody className="space-y-4">
            <FormField
              label="Supplier Name"
              htmlFor="supplierName"
              required
              error={form.formState.errors.supplierName?.message}
            >
              <Input
                id="supplierName"
                placeholder="Enter supplier name"
                autoComplete="organization"
                {...form.register("supplierName")}
              />
            </FormField>

            <FormField label="Contact Person Name" htmlFor="contactPerson">
              <Input
                id="contactPerson"
                placeholder="Enter contact person name"
                autoComplete="name"
                {...form.register("contactPerson")}
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Phone"
                htmlFor="phone"
                error={form.formState.errors.phone?.message}
              >
                <Input
                  id="phone"
                  {...bindPhoneInput(form, "phone", {
                    placeholder: "Phone (optional)",
                  })}
                />
              </FormField>
              <FormField
                label="Email"
                htmlFor="email"
                error={form.formState.errors.email?.message}
              >
                <Input
                  id="email"
                  placeholder="Email (optional)"
                  {...bindEmailInput(form, "email")}
                />
              </FormField>
            </div>

            <FormField label="Address" htmlFor="address">
              <Textarea
                id="address"
                rows={3}
                placeholder="Address (optional)"
                {...form.register("address")}
              />
            </FormField>

            <FormField
              label="GST Number"
              htmlFor="gstNumber"
              error={form.formState.errors.gstNumber?.message}
            >
              <Input
                id="gstNumber"
                {...bindGstinInput(form, "gstNumber", {
                  placeholder: "GST number (optional)",
                })}
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
              ) : isEdit ? (
                "Update Supplier"
              ) : (
                "Save Supplier"
              )}
            </Button>
          </ModalCardFooter>
        </form>
      </ModalCardContent>
    </ModalCard>
  );
}
