import { z } from "zod";

export const contactLeadSchema = z
  .object({
    fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
    phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
    email: z.string().trim().email("Enter a valid email"),
    businessName: z
      .string()
      .trim()
      .min(2, "Business name must be at least 2 characters")
      .max(100),
    category: z.string().trim().max(80).optional().or(z.literal("")),
    message: z.string().trim().max(500).optional().or(z.literal("")),
    source: z.string().trim().min(1),
    sourceDetail: z.string().trim().max(100).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (
      (data.source === "other" ||
        data.source === "referral-customer" ||
        data.source === "referral-partner") &&
      (!data.sourceDetail || data.sourceDetail.trim().length < 2)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter a short description (at least 2 characters)",
        path: ["sourceDetail"],
      });
    }
  });

export type ContactLeadInput = z.infer<typeof contactLeadSchema>;

export const LEAD_SOURCE_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter", label: "Twitter / X" },
  { value: "google-ads", label: "Google Ads" },
  { value: "referral-customer", label: "Referral – existing customer" },
  { value: "referral-partner", label: "Referral – partner" },
  { value: "phone-call", label: "Phone call" },
  { value: "walk-in", label: "Walk-in / store visit" },
  { value: "event", label: "Trade show / event" },
  { value: "email-campaign", label: "Email campaign" },
  { value: "website", label: "Website" },
  { value: "other", label: "Other" },
] as const;
