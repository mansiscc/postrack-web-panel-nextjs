import { z } from "zod";

export const businessProfileSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required").max(200),
  phone: z.string().trim().max(20).optional().nullable(),
  email: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: "Enter a valid email",
    }),
  address: z.string().trim().max(500).optional().nullable(),
  gstin: z.string().trim().max(15).optional().nullable(),
  invoicePrefix: z
    .string()
    .trim()
    .min(1, "Invoice prefix is required")
    .max(10, "Max 10 characters"),
  receiptFooter: z.string().trim().max(500).optional().nullable(),
  showLogoOnBill: z.boolean(),
  logoUrl: z.string().url().optional().nullable().or(z.literal("")),
});

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
