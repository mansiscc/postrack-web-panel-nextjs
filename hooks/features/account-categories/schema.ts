import { z } from "zod";

import { categoryName } from "@/lib/validation/fields";

export const accountingCategorySchema = z.object({
  name: categoryName,
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
