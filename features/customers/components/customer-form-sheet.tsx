"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createCustomerAction,
  updateCustomerAction,
} from "@/features/customers/actions";
import {
  customerSchema,
  type CustomerFormInput,
} from "@/features/customers/schema";
import type { CustomerListItem } from "@/features/customers/types";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-120">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit customer" : "Add customer"}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-2">
            <FormField
              label="Name"
              htmlFor="name"
              required
              error={form.formState.errors.name?.message}
            >
              <Input id="name" {...form.register("name")} />
            </FormField>
            <FormField
              label="Phone"
              htmlFor="phone"
              required
              error={form.formState.errors.phone?.message}
            >
              <Input id="phone" {...form.register("phone")} />
            </FormField>
            <FormField
              label="Email"
              htmlFor="email"
              error={form.formState.errors.email?.message}
            >
              <Input id="email" type="email" {...form.register("email")} />
            </FormField>
            <FormField label="Address" htmlFor="address">
              <Textarea id="address" rows={3} {...form.register("address")} />
            </FormField>
            <FormField label="Active">
              <Switch
                checked={form.watch("isActive")}
                onCheckedChange={(checked) => form.setValue("isActive", checked)}
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
