import { z } from "zod";

export const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or less")
    .optional()
    .nullable(),
  openingBalance: z.coerce
    .number()
    .min(0, "Opening balance cannot be negative"),
  isActive: z.boolean(),
});

export type AccountFormInput = z.infer<typeof accountSchema>;
