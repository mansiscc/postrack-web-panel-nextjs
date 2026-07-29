import { z } from "zod";

import {
  invoicePrefix,
  optionalEmail,
  optionalGstin,
  optionalIndianMobile,
  personName,
} from "@/lib/validation/fields";

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
  logoUrl: z.string().url().optional().nullable().or(z.literal("")),
});

export type BusinessProfileInput = z.input<typeof businessProfileSchema>;
