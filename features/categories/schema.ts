import { z } from "zod";

import { categoryName } from "@/lib/validation/fields";

export const categorySchema = z.object({
  name: categoryName,
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or less")
    .optional()
    .nullable(),
  isActive: z.boolean(),
});

export type CategoryFormInput = z.infer<typeof categorySchema>;
