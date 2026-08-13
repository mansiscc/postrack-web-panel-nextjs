import { z } from "zod";

import {
  nonNegativeNumber,
  optionalNumberFromInput,
  optionalProductBarcode,
  personName,
} from "@/lib/validation/fields";

/** Form may hold a remote https URL or a local blob: preview until Save. */
const imageUrlField = z
  .union([
    z
      .string()
      .refine(
        (value) => {
          try {
            const parsed = new URL(value);
            return (
              parsed.protocol === "http:" ||
              parsed.protocol === "https:" ||
              parsed.protocol === "blob:"
            );
          } catch {
            return false;
          }
        },
        { message: "Invalid image URL" },
      ),
    z.literal(""),
    z.null(),
  ])
  .optional()
  .transform((value) => (value && value !== "" ? value : null));

const productFields = z.object({
  /** Optional client-generated id so Cloudinary upload path matches the new product row. */
  id: z.string().uuid().optional(),
  name: personName("Product name").max(200),
  barcode: optionalProductBarcode,
  purchasePrice: optionalNumberFromInput.refine(
    (value) => value === null || value === undefined || value >= 0,
    { message: "Purchase price must be 0 or greater" },
  ),
  sellingPrice: optionalNumberFromInput,
  mrp: optionalNumberFromInput,
  unit: z.string().trim().max(20).optional().nullable(),
  lowStockAlertQty: nonNegativeNumber("Low stock alert"),
  productCategoryId: z
    .union([z.string().uuid(), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value && value !== "" ? value : null)),
  openingStock: nonNegativeNumber("Opening stock"),
  stockQuantity: nonNegativeNumber("Stock quantity"),
  isActive: z.boolean(),
  imageUrl: imageUrlField,
});

function validateProductPricing(
  data: {
    purchasePrice?: number | null;
    sellingPrice?: number | null;
    mrp?: number | null;
  },
  ctx: z.RefinementCtx,
) {
  if (data.sellingPrice == null || Number.isNaN(data.sellingPrice)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Selling price is required",
      path: ["sellingPrice"],
    });
  } else if (data.sellingPrice < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Selling price must be 0 or greater",
      path: ["sellingPrice"],
    });
  }

  if (data.mrp == null || Number.isNaN(data.mrp)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "MRP is required",
      path: ["mrp"],
    });
  } else if (data.mrp < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "MRP must be 0 or greater",
      path: ["mrp"],
    });
  }

  if (
    data.purchasePrice != null &&
    data.sellingPrice != null &&
    data.sellingPrice < data.purchasePrice
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Selling price cannot be less than purchase price",
      path: ["sellingPrice"],
    });
  }
}

export const createProductSchema = productFields.superRefine(validateProductPricing);
export const updateProductSchema = productFields
  .omit({ openingStock: true, id: true })
  .superRefine(validateProductPricing);

export type ProductFormInput = z.input<typeof productFields>;
export type CreateProductInput = z.input<typeof createProductSchema>;
export type UpdateProductInput = z.input<typeof updateProductSchema>;
export type ParsedCreateProductInput = z.infer<typeof createProductSchema>;
export type ParsedUpdateProductInput = z.infer<typeof updateProductSchema>;
