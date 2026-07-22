import { z } from "zod";

const optionalNumber = z
  .union([z.number(), z.string()])
  .transform((value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = typeof value === "number" ? value : Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  })
  .nullable()
  .optional();

export const supplierSchema = z.object({
  supplierName: z.string().trim().min(1, "Supplier name is required").max(200),
  contactPerson: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  address: z.string().trim().max(500).optional().nullable(),
  gstNumber: z.string().trim().max(20).optional().nullable(),
  openingBalance: optionalNumber,
});

export type SupplierFormInput = z.input<typeof supplierSchema>;
