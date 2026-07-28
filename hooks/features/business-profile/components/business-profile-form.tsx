"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { updateBusinessProfileAction } from "@/hooks/features/business-profile/actions";
import {
  businessProfileSchema,
  type BusinessProfileInput,
} from "@/hooks/features/business-profile/schema";
import { AvatarUpload } from "@/components/forms/avatar-upload";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

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

  const businessName = form.watch("businessName");

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await updateBusinessProfileAction({
      ...values,
      invoicePrefix: values.invoicePrefix.trim().toUpperCase() || "B",
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Business profile saved successfully");
  });

  return (
    <>
      {!canEdit ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Only admins and managers can update the business profile.
        </p>
      ) : null}

      <form
        id="business-profile-form"
        onSubmit={onSubmit}
        className="space-y-4 lg:space-y-6"
      >
        <Card>
          <CardContent>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10 xl:gap-12">
              <div className="w-full shrink-0 lg:max-w-70 xl:max-w-80">
                <FormField label="Logo">
                  <AvatarUpload
                    layout="banner"
                    value={form.watch("logoUrl") || null}
                    onChange={(url) => form.setValue("logoUrl", url ?? "")}
                    disabled={!canEdit}
                    emptyLabel="No logo selected"
                    chooseLabel="Choose Logo"
                    changeLabel="Change Logo"
                    removeLabel="Remove Logo"
                    helpText="Pick an image from this device for the business logo preview."
                  />
                </FormField>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-4">
                {canEdit ? (
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={form.formState.isSubmitting}
                    >
                      {form.formState.isSubmitting ? (
                        <>
                          <Loader2 className="animate-spin" />
                          Saving…
                        </>
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </div>
                ) : null}

                <div className="rounded-xl border border-border/60 bg-surface-variant/30 p-4 lg:p-5">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Business Profile
                  </p>
                  <p className="mt-1 text-xl font-bold tracking-tight lg:text-2xl">
                    {businessName || "—"}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-surface-variant/50 p-4 lg:p-5">
                  <div className="min-w-0 space-y-1">
                    <Label className="text-sm font-medium">
                      Show logo on printed bill
                    </Label>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Enable this to print the business logo on receipts when a
                      logo is available.
                    </p>
                  </div>
                  <Switch
                    disabled={!canEdit}
                    checked={form.watch("showLogoOnBill")}
                    onCheckedChange={(checked) =>
                      form.setValue("showLogoOnBill", checked)
                    }
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
          <Card className="h-full">
            <CardHeader className="border-b border-border/60">
              <CardTitle>Business Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-0">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Business Name"
                  htmlFor="businessName"
                  required
                  error={form.formState.errors.businessName?.message}
                >
                  <Input
                    id="businessName"
                    placeholder="Enter business name"
                    disabled={!canEdit}
                    {...form.register("businessName")}
                  />
                </FormField>

                <FormField
                  label="Business Category"
                  htmlFor="businessCategory"
                  error={form.formState.errors.businessCategory?.message}
                >
                  <Input
                    id="businessCategory"
                    placeholder="Optional"
                    disabled={!canEdit}
                    {...form.register("businessCategory")}
                  />
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Phone"
                  htmlFor="phone"
                  error={form.formState.errors.phone?.message}
                >
                  <Input
                    id="phone"
                    placeholder="Optional"
                    disabled={!canEdit}
                    {...form.register("phone")}
                  />
                </FormField>

                <FormField
                  label="Email"
                  htmlFor="email"
                  error={form.formState.errors.email?.message}
                >
                  <Input
                    id="email"
                    type="email"
                    placeholder="Optional"
                    disabled
                    readOnly
                    {...form.register("email")}
                  />
                </FormField>
              </div>

              <FormField
                label="Address"
                htmlFor="address"
                error={form.formState.errors.address?.message}
              >
                <Textarea
                  id="address"
                  rows={3}
                  placeholder="Optional"
                  disabled={!canEdit}
                  {...form.register("address")}
                />
              </FormField>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader className="border-b border-border/60">
              <CardTitle>Receipt Details</CardTitle>
              <CardDescription>
                Used in bill number: e.g. B2606-1
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-0">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="GSTIN"
                  htmlFor="gstin"
                  error={form.formState.errors.gstin?.message}
                >
                  <Input
                    id="gstin"
                    placeholder="Optional"
                    disabled={!canEdit}
                    {...form.register("gstin")}
                  />
                </FormField>

                <FormField
                  label="Invoice Prefix"
                  htmlFor="invoicePrefix"
                  required
                  error={form.formState.errors.invoicePrefix?.message}
                >
                  <Input
                    id="invoicePrefix"
                    placeholder="Default: B"
                    disabled={!canEdit}
                    {...form.register("invoicePrefix")}
                  />
                </FormField>
              </div>

              <FormField
                label="Receipt Footer"
                htmlFor="receiptFooter"
                error={form.formState.errors.receiptFooter?.message}
              >
                <Textarea
                  id="receiptFooter"
                  rows={4}
                  placeholder="Optional (thank you message, etc.)"
                  disabled={!canEdit}
                  {...form.register("receiptFooter")}
                />
              </FormField>
            </CardContent>
          </Card>
        </div>
      </form>
    </>
  );
}
