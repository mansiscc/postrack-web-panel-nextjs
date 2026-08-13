import { z } from "zod";

import {
  invoicePrefix,
  optionalEmail,
  optionalGstin,
  optionalIndianMobile,
  personName,
} from "@/lib/validation/fields";

/** Form may hold a remote https URL or a local blob: preview until Save. */
const logoUrlField = z
  .union([
    z
      .string()
      .refine(
        (value) => {
          if (!value) return true;
          try {
            const parsed = new URL(value);
            return (
              parsed.protocol === "http:" ||
              parsed.protocol === "https:" ||
              parsed.protocol === "blob:"
            );
          } catch {
            return false;
          }
        },
        { message: "Invalid logo URL" },
      ),
    z.literal(""),
  ])
  .optional()
  .nullable();

export const businessProfileSchema = z.object({
  businessName: personName("Business name").max(200),
  businessCategory: z.string().trim().max(100).optional().nullable(),
  phone: optionalIndianMobile,
  email: optionalEmail,
  address: z.string().trim().max(500).optional().nullable(),
  gstin: optionalGstin(15),
  invoicePrefix,
  receiptFooter: z.string().trim().max(500).optional().nullable(),
  showLogoOnBill: z.boolean(),
  logoUrl: logoUrlField,
});

export type BusinessProfileInput = z.input<typeof businessProfileSchema>;
