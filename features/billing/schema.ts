import { z } from "zod";

const cartItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string().min(1),
  barcode: z.string().optional().nullable(),
  unitPrice: z.number().min(0),
  quantity: z.number().positive(),
  batchId: z.string().uuid().optional().nullable(),
  batchName: z.string().optional().nullable(),
  maxQuantity: z.number().positive().optional(),
  isManual: z.boolean().optional(),
});

export const saveBillSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Cart is empty"),
  customerId: z
    .union([z.string().uuid(), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value && value !== "" ? value : null)),
  customerName: z.string().trim().optional(),
  customerPhone: z.string().trim().optional(),
  otherItemsAmount: z.number().min(0).optional(),
  discountType: z.enum(["AMOUNT", "PERCENT"]).optional().nullable(),
  discountValue: z.number().min(0).optional(),
  paymentMode: z.enum(["Cash", "UPI", "Card", "Mixed"]),
  mixedCashAmount: z.number().min(0).optional(),
  mixedUpiAmount: z.number().min(0).optional(),
  receivedAmount: z.number().min(0),
  accountId: z.string().uuid("Select a payment account"),
});

export const returnBillSchema = z.object({
  billId: z.string().uuid(),
  refundMethod: z.enum(["Cash", "UPI", "Card", "Mixed"]),
  returnNote: z.string().trim().max(500).optional().nullable(),
  items: z
    .array(
      z.object({
        billItemId: z.string().uuid(),
        productId: z.string().uuid(),
        productName: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().min(0),
      }),
    )
    .min(1, "Select at least one item to return"),
});

export type SaveBillInput = z.infer<typeof saveBillSchema>;
export type ReturnBillInput = z.infer<typeof returnBillSchema>;
