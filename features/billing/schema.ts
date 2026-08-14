import { z } from "zod";

import { INDIAN_MOBILE_REGEX } from "@/lib/validation/fields";

const cartItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string().min(1),
  barcode: z.string().optional().nullable(),
  unitPrice: z.number().min(0),
  mrp: z.number().min(0).optional().nullable(),
  quantity: z.number().positive(),
  batchId: z.string().uuid().optional().nullable(),
  batchName: z.string().optional().nullable(),
  maxQuantity: z.number().positive().optional(),
  isManual: z.boolean().optional(),
});

export const saveBillSchema = z
  .object({
    items: z.array(cartItemSchema).default([]),
    customerId: z
      .union([z.string().uuid(), z.literal(""), z.null()])
      .optional()
      .transform((value) => (value && value !== "" ? value : null)),
    customerName: z.string().trim().optional(),
    customerPhone: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) => !value || INDIAN_MOBILE_REGEX.test(value),
        "Enter a valid 10-digit mobile number",
      ),
    otherItemsAmount: z.number().min(0).optional(),
    discountType: z.enum(["AMOUNT", "PERCENT"]).optional().nullable(),
    discountValue: z.number().min(0).optional(),
    paymentMode: z.enum(["Cash", "UPI", "Card", "Mixed"]),
    mixedCashAmount: z.number().min(0).optional(),
    mixedUpiAmount: z.number().min(0).optional(),
    receivedAmount: z.number().min(0),
    accountId: z
      .union([z.string().uuid(), z.literal("")])
      .optional()
      .transform((value) => (value && value !== "" ? value : "")),
  })
  .superRefine((data, ctx) => {
    if (data.items.length === 0 && (data.otherItemsAmount ?? 0) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add cart items or an other-items amount",
        path: ["items"],
      });
    }
    if (data.receivedAmount > 0 && !data.accountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a payment account",
        path: ["accountId"],
      });
    }
  });

export const returnBillSchema = z.object({
  billId: z.string().uuid(),
  refundMethod: z.enum(["Cash", "UPI", "Card", "Mixed"]),
  refundAccountId: z.string().uuid("Select a refund account"),
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

export const completePaymentSchema = z.object({
  billId: z.string().uuid(),
  accountId: z
    .union([z.string().uuid(), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value && value !== "" ? value : null)),
});

export type SaveBillInput = z.infer<typeof saveBillSchema>;
export type ReturnBillInput = z.infer<typeof returnBillSchema>;
export type CompletePaymentInput = z.infer<typeof completePaymentSchema>;
