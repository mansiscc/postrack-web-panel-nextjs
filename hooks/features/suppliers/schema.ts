import { z } from "zod";

import {
  optionalEmail,
  optionalGstin,
  optionalIndianMobile,
  optionalNumberFromInput,
  personName,
} from "@/lib/validation/fields";

export const supplierSchema = z.object({
  supplierName: personName("Supplier name").max(200),
  contactPerson: z.string().trim().max(100).optional().nullable(),
  phone: optionalIndianMobile,
  email: optionalEmail,
  address: z.string().trim().max(500).optional().nullable(),
  gstNumber: optionalGstin(15),
  openingBalance: optionalNumberFromInput.refine(
    (value) => value === null || value === undefined || value >= 0,
    { message: "Opening balance must be 0 or greater" },
  ),
});

export type SupplierFormInput = z.input<typeof supplierSchema>;
