import { z } from "zod";

export const transactionSchema = z.object({
  entryType: z.enum(["income", "expense"]),
  accountId: z.string().uuid("Select an account"),
  categoryId: z.string().uuid("Select a category"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  entryDate: z.string().min(1, "Date is required"),
  remarks: z
    .string()
    .trim()
    .max(500, "Remarks must be 500 characters or less")
    .optional()
    .nullable(),
  paymentMode: z.enum(["Cash", "UPI", "Card", "Mixed"]).optional().nullable(),
});

export type TransactionFormInput = z.infer<typeof transactionSchema>;
