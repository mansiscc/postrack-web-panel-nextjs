import { z } from "zod";

import {
  optionalEmail,
  optionalIndianMobile,
  personName,
  requiredEmail,
} from "@/lib/validation/fields";

const roleEnum = z.enum(["Admin", "Manager", "Staff"]);
const statusEnum = z.enum(["Active", "Inactive"]);

const permissionFields = {
  permissionStockIn: z.boolean(),
  permissionStockOut: z.boolean(),
};

export const createUserSchema = z
  .object({
    fullName: personName("Full name"),
    email: requiredEmail,
    phone: optionalIndianMobile,
    role: roleEnum,
    status: statusEnum,
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Re-enter password"),
    ...permissionFields,
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

export const updateUserSchema = z.object({
  fullName: personName("Full name"),
  phone: optionalIndianMobile,
  role: roleEnum,
  status: statusEnum,
  ...permissionFields,
});

export const changePasswordSchema = z
  .object({
    userId: z.string().uuid(),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Re-enter password"),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

export type CreateUserInput = z.input<typeof createUserSchema>;
export type UpdateUserInput = z.input<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
