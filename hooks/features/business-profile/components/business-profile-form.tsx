"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import {
  deleteStoredImage,
  isRemoteImageUrl,
  resolveImageUrlForSave,
} from "@/lib/uploads/client-image";
import {
  bindAlphanumericInput,
  bindGstinInput,
  bindPhoneInput,
} from "@/lib/validation/rhf";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PRINT_SETTINGS,
  readPrintSettings,
  writePrintSettings,
  type ReceiptPaperWidth,
} from "@/utils/print-settings";

/** Android Device Manager paper-size options. */
const PAPER_SIZE_OPTIONS: Array<{
  value: ReceiptPaperWidth;
  label: string;
  hint: string;
}> = [
  { value: "58mm", label: "58mm", hint: "Compact receipt roll" },
  { value: "76mm", label: "76mm", hint: "Medium receipt roll" },
  { value: "80mm", label: "80mm", hint: "Standard POS roll" },
];

type BusinessProfileFormProps = {
  initial: BusinessProfileInput;
  canEdit: boolean;
};

export function BusinessProfileForm({
  initial,
  canEdit,
}: BusinessProfileFormProps) {
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidth>(
    DEFAULT_PRINT_SETTINGS.paperWidth,
  );
  const form = useForm<BusinessProfileInput>({
    resolver: zodResolver(businessProfileSchema),
    defaultValues: initial,
  });

  useEffect(() => {
    setPaperWidth(readPrintSettings().paperWidth);
  }, []);

  const businessName = form.watch("businessName");
  const previousRemoteLogoUrl = isRemoteImageUrl(initial.logoUrl)
    ? initial.logoUrl
    : null;

  const handlePaperWidthChange = (next: ReceiptPaperWidth) => {
    // Android DeviceManagerViewModel.selectPaperSize — persist immediately on tap.
    const current = readPrintSettings();
    writePrintSettings({ ...current, paperWidth: next });
    setPaperWidth(next);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    let logoUrl: string | null;
    try {
      logoUrl = await resolveImageUrlForSave({
        pendingFile: pendingLogoFile,
        currentUrl: values.logoUrl,
        kind: "business_logo",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Logo upload failed",
      );
      return;
    }

    const result = await updateBusinessProfileAction({
      ...values,
      logoUrl: logoUrl ?? "",
      invoicePrefix: values.invoicePrefix.trim().toUpperCase() || "B",
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }

    if (previousRemoteLogoUrl && !logoUrl) {
      void deleteStoredImage({ kind: "business_logo" });
    }

    setPendingLogoFile(null);
    if (logoUrl) {
      form.setValue("logoUrl", logoUrl);
    } else {
      form.setValue("logoUrl", "");
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
                    onPendingFileChange={setPendingLogoFile}
                    disabled={!canEdit}
                    emptyLabel="No logo selected"
                    chooseLabel="Choose Logo"
                    changeLabel="Change Logo"
                    removeLabel="Remove Logo"
                    helpText="Choose a logo to preview. It uploads when you save."
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
                    disabled={!canEdit}
                    {...bindPhoneInput(form, "phone", {
                      placeholder: "10-digit mobile",
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
                    disabled={!canEdit}
                    {...bindGstinInput(form, "gstin")}
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
                    disabled={!canEdit}
                    {...bindAlphanumericInput(form, "invoicePrefix", {
                      maxLength: 6,
                      placeholder: "Default: B",
                    })}
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

              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    Receipt paper size
                  </Label>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Choose the paper width used by your thermal printer so bills
                    fit correctly. Applies immediately on this browser (not part
                    of Save).
                  </p>
                </div>
                <div
                  role="radiogroup"
                  aria-label="Receipt paper size"
                  className="grid grid-cols-3 gap-2"
                >
                  {PAPER_SIZE_OPTIONS.map((option) => {
                    const selected = paperWidth === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => handlePaperWidthChange(option.value)}
                        className={cn(
                          "rounded-xl border px-3 py-3 text-left transition-colors",
                          selected
                            ? "border-primary/40 bg-primary/10"
                            : "border-border/60 bg-surface-variant/40 hover:bg-muted/50",
                        )}
                      >
                        <span
                          className={cn(
                            "block text-[13px] font-semibold",
                            selected ? "text-primary" : "text-foreground",
                          )}
                        >
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {option.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </>
  );
}
