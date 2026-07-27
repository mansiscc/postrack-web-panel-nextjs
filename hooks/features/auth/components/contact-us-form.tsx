"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  contactLeadSchema,
  LEAD_SOURCE_OPTIONS,
  type ContactLeadInput,
} from "@/hooks/features/auth/schema-contact";
import { submitDemoLead } from "@/hooks/features/auth/submit-demo-lead";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function ContactUsForm() {
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ContactLeadInput>({
    resolver: zodResolver(contactLeadSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      businessName: "",
      category: "",
      message: "",
      source: "website",
      sourceDetail: "",
    },
  });

  const source = form.watch("source");
  const needsDetail =
    source === "other" ||
    source === "referral-customer" ||
    source === "referral-partner";

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const result = await submitDemoLead(values);
    if (!result.success) {
      setFormError(result.error);
      return;
    }
    setSuccessMessage(result.message);
    setSubmitted(true);
  });

  if (submitted) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-semibold">Request received</h2>
        <p className="text-sm text-muted-foreground">{successMessage}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button type="button" variant="outline" asChild>
            <Link href="/login">Back to sign in</Link>
          </Button>
          <Button
            type="button"
            onClick={() => {
              setSubmitted(false);
              form.reset({
                fullName: "",
                phone: "",
                email: "",
                businessName: "",
                category: "",
                message: "",
                source: "website",
                sourceDetail: "",
              });
            }}
          >
            Submit another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField
        label="Full name"
        htmlFor="fullName"
        required
        error={form.formState.errors.fullName?.message}
      >
        <Input id="fullName" {...form.register("fullName")} />
      </FormField>
      <FormField
        label="Phone"
        htmlFor="phone"
        required
        error={form.formState.errors.phone?.message}
      >
        <Input
          id="phone"
          inputMode="numeric"
          maxLength={10}
          placeholder="10-digit mobile"
          {...form.register("phone")}
          onChange={(event) =>
            form.setValue(
              "phone",
              event.target.value.replace(/\D/g, "").slice(0, 10),
              { shouldValidate: true },
            )
          }
        />
      </FormField>
      <FormField
        label="Email"
        htmlFor="email"
        required
        error={form.formState.errors.email?.message}
      >
        <Input id="email" type="email" {...form.register("email")} />
      </FormField>
      <FormField
        label="Business name"
        htmlFor="businessName"
        required
        error={form.formState.errors.businessName?.message}
      >
        <Input id="businessName" {...form.register("businessName")} />
      </FormField>
      <FormField
        label="Business category"
        htmlFor="category"
        error={form.formState.errors.category?.message}
      >
        <Input
          id="category"
          placeholder="Retail, grocery, pharmacy…"
          {...form.register("category")}
        />
      </FormField>
      <FormField
        label="How did you hear about us?"
        required
        error={form.formState.errors.source?.message}
      >
        <Select
          value={form.watch("source")}
          onValueChange={(value) => form.setValue("source", value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_SOURCE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      {needsDetail ? (
        <FormField
          label="Source details"
          htmlFor="sourceDetail"
          required
          error={form.formState.errors.sourceDetail?.message}
        >
          <Input id="sourceDetail" {...form.register("sourceDetail")} />
        </FormField>
      ) : null}
      <FormField
        label="Message"
        htmlFor="message"
        error={form.formState.errors.message?.message}
      >
        <Textarea id="message" rows={3} {...form.register("message")} />
      </FormField>

      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Submitting…
          </>
        ) : (
          "Request demo access"
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
