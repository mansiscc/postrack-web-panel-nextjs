import { z } from "zod";

const roleEnum = z.enum(["Admin", "Manager", "Staff"]);
const statusEnum = z.enum(["Active", "Inactive"]);

export const createUserSchema = z
  .object({
    fullName: z.string().trim().min(1, "Name is required").max(100),
    email: z.string().trim().email("Enter a valid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    phone: z.string().trim().max(20).optional().nullable(),
    role: roleEnum,
    status: statusEnum,
    permissionStockIn: z.boolean(),
    permissionStockOut: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "Staff" && !data.permissionStockIn && !data.permissionStockOut) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Staff must have at least one permission",
        path: ["permissionStockIn"],
      });
    }
  });

export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(1, "Name is required").max(100),
    phone: z.string().trim().max(20).optional().nullable(),
    role: roleEnum,
    status: statusEnum,
    permissionStockIn: z.boolean(),
    permissionStockOut: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "Staff" && !data.permissionStockIn && !data.permissionStockOut) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Staff must have at least one permission",
        path: ["permissionStockIn"],
      });
    }
  });

export const changePasswordSchema = z.object({
  userId: z.string().uuid(),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
