import { z } from "zod";

import { requiredEmail } from "@/lib/validation/fields";

export const loginSchema = z.object({
  email: requiredEmail,
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
