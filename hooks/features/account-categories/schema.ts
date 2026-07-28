import { z } from "zod";

export const accountingCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required")
    .min(2, "Category name must be at least 2 characters")
    .max(100, "Name must be 100 characters or less"),
  type: z.enum(["income", "expense"]),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or less")
    .optional()
    .nullable(),
  isActive: z.boolean(),
});

export type AccountingCategoryFormInput = z.infer<
  typeof accountingCategorySchema
>;
