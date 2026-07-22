"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { updateBusinessProfileAction } from "@/features/business-profile/actions";
import {
  businessProfileSchema,
  type BusinessProfileInput,
} from "@/features/business-profile/schema";
import { AvatarUpload } from "@/components/forms/avatar-upload";
import { FormField } from "@/components/forms/form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

type BusinessProfileFormProps = {
  initial: BusinessProfileInput;
  canEdit: boolean;
};

export function BusinessProfileForm({
  initial,
  canEdit,
}: BusinessProfileFormProps) {
  const form = useForm<BusinessProfileInput>({
    resolver: zodResolver(businessProfileSchema),
    defaultValues: initial,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await updateBusinessProfileAction(values);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Business profile saved");
  });

  return (
    <>
      <PageHeader
        title="Business profile"
        description="Store branding and invoice settings used on bills and receipts."
        actions={
          canEdit ? (
            <Button
              type="submit"
              form="business-profile-form"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          ) : null
        }
      />

      {!canEdit ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Only admins and managers can update the business profile.
        </p>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <form
            id="business-profile-form"
            onSubmit={onSubmit}
            className="space-y-8"
          >
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Branding</h2>
              <FormField label="Logo">
                <AvatarUpload
                  value={form.watch("logoUrl") || null}
                  onChange={(url) => form.setValue("logoUrl", url ?? "")}
                  disabled={!canEdit}
                />
              </FormField>
              <div className="grid gap-4 lg:grid-cols-2">
                <FormField
                  label="Business name"
                  required
                  error={form.formState.errors.businessName?.message}
                >
                  <Input
                    disabled={!canEdit}
                    {...form.register("businessName")}
                  />
                </FormField>
                <FormField
                  label="Invoice prefix"
                  required
                  hint="Used in bill numbers, e.g. B2607-1"
                  error={form.formState.errors.invoicePrefix?.message}
                >
                  <Input
                    disabled={!canEdit}
                    {...form.register("invoicePrefix")}
                  />
                </FormField>
              </div>
              <FormField label="Show logo on bill">
                <Switch
                  disabled={!canEdit}
                  checked={form.watch("showLogoOnBill")}
                  onCheckedChange={(checked) =>
                    form.setValue("showLogoOnBill", checked)
                  }
                />
              </FormField>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Contact</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                <FormField label="Phone" error={form.formState.errors.phone?.message}>
                  <Input disabled={!canEdit} {...form.register("phone")} />
                </FormField>
                <FormField label="Email" error={form.formState.errors.email?.message}>
                  <Input
                    disabled={!canEdit}
                    type="email"
                    {...form.register("email")}
                  />
                </FormField>
              </div>
              <FormField label="Address" error={form.formState.errors.address?.message}>
                <Textarea
                  disabled={!canEdit}
                  rows={3}
                  {...form.register("address")}
                />
              </FormField>
              <FormField label="GSTIN" error={form.formState.errors.gstin?.message}>
                <Input disabled={!canEdit} {...form.register("gstin")} />
              </FormField>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Receipt</h2>
              <FormField
                label="Receipt footer"
                error={form.formState.errors.receiptFooter?.message}
              >
                <Textarea
                  disabled={!canEdit}
                  rows={3}
                  placeholder="Thank you for shopping with us!"
                  {...form.register("receiptFooter")}
                />
              </FormField>
            </section>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
