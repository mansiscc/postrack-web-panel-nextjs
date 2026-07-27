import { z } from "zod";

const requiredNumber = z
  .union([z.number(), z.string()])
  .transform((value) => {
    const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  });

const optionalNumber = z
  .union([z.number(), z.string()])
  .transform((value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  })
  .nullable()
  .optional();

export const purchaseLineItemSchema = z.object({
  productId: z.string().uuid("Select a product"),
  quantity: requiredNumber.refine((value) => value > 0, {
    message: "Quantity must be greater than 0",
  }),
  purchasePrice: requiredNumber.refine((value) => value >= 0, {
    message: "Purchase price must be 0 or greater",
  }),
  sellingPrice: optionalNumber,
  mrp: optionalNumber,
  batchName: z.string().trim().max(100).optional().nullable(),
  rowTotal: requiredNumber.refine((value) => value >= 0, {
    message: "Row total must be 0 or greater",
  }),
});

export const createPurchaseSchema = z.object({
  date: z.string().min(1, "Date is required"),
  supplierId: z
    .union([z.string().uuid(), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value && value !== "" ? value : null)),
  invoiceNumber: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  accountId: z.string().uuid("Select a payment account"),
  items: z.array(purchaseLineItemSchema).min(1, "Add at least one line item"),
});

export type PurchaseLineItemInput = z.input<typeof purchaseLineItemSchema>;
export type CreatePurchaseFormInput = z.input<typeof createPurchaseSchema>;
