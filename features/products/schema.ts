import { z } from "zod";

const optionalNumber = z
  .union([z.number(), z.string()])
  .transform((value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = typeof value === "number" ? value : Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  })
  .nullable()
  .optional();

const requiredNumber = z
  .union([z.number(), z.string()])
  .transform((value) => {
    const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  });

export const productFormSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(200),
  barcode: z.string().trim().max(50).optional().nullable(),
  purchasePrice: optionalNumber,
  sellingPrice: optionalNumber,
  mrp: optionalNumber,
  unit: z.string().trim().max(20).optional().nullable(),
  lowStockAlertQty: requiredNumber.refine((value) => value >= 0, {
    message: "Low stock alert must be 0 or greater",
  }),
  productCategoryId: z
    .union([z.string().uuid(), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value && value !== "" ? value : null)),
  openingStock: requiredNumber.refine((value) => value >= 0, {
    message: "Opening stock must be 0 or greater",
  }),
  stockQuantity: requiredNumber.refine((value) => value >= 0, {
    message: "Stock quantity must be 0 or greater",
  }),
  isActive: z.boolean(),
  imageUrl: z
    .union([z.string().url(), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value && value !== "" ? value : null)),
});

export const createProductSchema = productFormSchema;
export const updateProductSchema = productFormSchema.omit({ openingStock: true });

export type ProductFormInput = z.input<typeof productFormSchema>;
export type CreateProductInput = z.input<typeof createProductSchema>;
export type UpdateProductInput = z.input<typeof updateProductSchema>;
export type ParsedCreateProductInput = z.infer<typeof createProductSchema>;
export type ParsedUpdateProductInput = z.infer<typeof updateProductSchema>;
