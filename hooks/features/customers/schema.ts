import { z } from "zod";

import {
  optionalEmail,
  optionalIndianMobile,
  personName,
  requiredIndianMobile,
} from "@/lib/validation/fields";

export const customerSchema = z.object({
  name: personName("Name"),
  phone: requiredIndianMobile,
  email: optionalEmail,
  address: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean(),
});

export type CustomerFormInput = z.input<typeof customerSchema>;
