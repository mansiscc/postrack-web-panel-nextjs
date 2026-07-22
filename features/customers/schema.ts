import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: z.string().trim().min(1, "Phone is required").max(20),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  address: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean(),
});

export type CustomerFormInput = z.input<typeof customerSchema>;
