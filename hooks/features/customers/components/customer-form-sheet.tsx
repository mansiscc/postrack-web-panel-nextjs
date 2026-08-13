"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createCustomerAction,
  updateCustomerAction,
} from "@/hooks/features/customers/actions";
import {
  customerSchema,
  type CustomerFormInput,
} from "@/hooks/features/customers/schema";
import type { CustomerListItem } from "@/hooks/features/customers/types";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bindEmailInput, bindPhoneInput } from "@/lib/validation/rhf";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ModalCard,
  ModalCardBody,
  ModalCardContent,
  ModalCardFooter,
  ModalCardHeader,
  ModalCardTitle,
} from "@/components/ui/modal-card";

type CustomerFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: CustomerListItem | null;
  onSuccess: () => void;
};

const emptyValues: CustomerFormInput = {
  name: "",
  phone: "",
  email: "",
  address: "",
  isActive: true,
};

export function CustomerFormSheet({
  open,
  onOpenChange,
  customer,
  onSuccess,
}: CustomerFormSheetProps) {
  const isEdit = Boolean(customer);
  const form = useForm<CustomerFormInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        customer
          ? {
              name: customer.name,
              phone: customer.phone,
              email: customer.email ?? "",
              address: customer.address ?? "",
              isActive: customer.isActive,
            }
          : emptyValues,
      );
    }
  }, [open, customer, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const result = isEdit
      ? await updateCustomerAction(customer!.id, values)
      : await createCustomerAction(values);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Customer updated" : "Customer created");
    onOpenChange(false);
    onSuccess();
  });

  return (
    <ModalCard open={open} onOpenChange={onOpenChange}>
      <ModalCardContent size="lg">
        <ModalCardHeader>
          <ModalCardTitle>
            {isEdit ? "Update Customer" : "Add New Customer"}
          </ModalCardTitle>
        </ModalCardHeader>
        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <ModalCardBody className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Customer Name"
                htmlFor="name"
                required
                error={form.formState.errors.name?.message}
              >
                <Input
                  id="name"
                  placeholder="Enter customer name"
                  {...form.register("name")}
                />
              </FormField>
              <FormField
                label="Phone Number"
                htmlFor="phone"
                required
                error={form.formState.errors.phone?.message}
              >
                <Input
                  id="phone"
                  {...bindPhoneInput(form, "phone", {
                    placeholder: "Enter mobile number",
                  })}
                />
              </FormField>
            </div>
            <FormField
              label="Email Address"
              htmlFor="email"
              error={form.formState.errors.email?.message}
            >
              <Input
                id="email"
                placeholder="Enter email (optional)"
                {...bindEmailInput(form, "email")}
              />
            </FormField>
            <FormField label="Address" htmlFor="address">
              <Textarea
                id="address"
                rows={3}
                placeholder="Enter address (optional)"
                {...form.register("address")}
              />
            </FormField>
            <FormField
              label="Active Status"
              hint="Inactive customers stay in history but are hidden from active usage."
            >
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2.5">
                <p className="text-sm text-foreground">
                  {form.watch("isActive") ? "Active customer" : "Inactive customer"}
                </p>
                <Switch
                  checked={form.watch("isActive")}
                  onCheckedChange={(checked) => form.setValue("isActive", checked)}
                />
              </div>
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
                isEdit ? "Update Customer" : "Save Customer"
              )}
            </Button>
          </ModalCardFooter>
        </form>
      </ModalCardContent>
    </ModalCard>
  );
}
