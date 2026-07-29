import { z } from "zod";

import { MANUAL_BILL_PRODUCT_BARCODE } from "@/lib/validation/constants";

/** Indian mobile: 10 digits, starts with 6–9 (matches Android demo lead + billing UI). */
export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export const requiredIndianMobile = z
  .string()
  .trim()
  .min(1, "Phone is required")
  .regex(INDIAN_MOBILE_REGEX, "Enter a valid 10-digit mobile number");

export const optionalIndianMobile = z
  .string()
  .trim()
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => (value ? value : null))
  .refine(
    (value) => value === null || INDIAN_MOBILE_REGEX.test(value),
    "Enter a valid 10-digit mobile number",
  );

export const requiredEmail = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address");

export const optionalEmail = z
  .string()
  .trim()
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => (value ? value : null))
  .refine(
    (value) => value === null || z.string().email().safeParse(value).success,
    "Enter a valid email address",
  );

export const categoryName = z
  .string()
  .trim()
  .min(1, "Name is required")
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be 100 characters or less");

export const personName = (label = "Name") =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(100, `${label} must be 100 characters or less`);

export const invoicePrefix = z
  .string()
  .trim()
  .min(1, "Invoice prefix is required")
  .max(6, "Invoice prefix must be 1-6 letters/numbers (A-Z, 0-9)")
  .regex(
    /^[A-Za-z0-9]+$/,
    "Invoice prefix must be 1-6 letters/numbers (A-Z, 0-9)",
  );

export const optionalNumberFromInput = z
  .union([z.number(), z.string()])
  .transform((value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed =
      typeof value === "number" ? value : Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  })
  .nullable()
  .optional();

export const requiredNumberFromInput = z
  .union([z.number(), z.string()])
  .transform((value) => {
    const parsed =
      typeof value === "number" ? value : Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  });

export const nonNegativeNumber = (label: string) =>
  requiredNumberFromInput.refine((value) => !Number.isNaN(value) && value >= 0, {
    message: `${label} must be 0 or greater`,
  });

export const positiveNumber = (label: string) =>
  requiredNumberFromInput.refine((value) => !Number.isNaN(value) && value > 0, {
    message: `${label} must be greater than 0`,
  });

export const optionalNonNegativeNumber = optionalNumberFromInput.refine(
  (value) => value === null || value === undefined || value >= 0,
  { message: "Must be 0 or greater" },
);

export function isReservedProductBarcode(value: string | null | undefined): boolean {
  return value?.trim() === MANUAL_BILL_PRODUCT_BARCODE;
}

/** Optional GSTIN / GST number — optional in Android; uppercase when provided. */
export const optionalGstin = (maxLength = 15) =>
  z
    .string()
    .trim()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((value) => {
      const normalized = value ? value.replace(/[^A-Za-z0-9]/g, "").toUpperCase() : "";
      return normalized || null;
    })
    .refine((value) => value === null || value.length <= maxLength, {
      message: `GSTIN must be ${maxLength} characters or less`,
    });

/**
 * Optional product barcode — unique per company in Android.
 * Blocks reserved system barcode used for manual bill lines.
 */
export const optionalProductBarcode = z
  .string()
  .trim()
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => {
    const normalized = value ? value.replace(/\s/g, "") : "";
    return normalized || null;
  })
  .refine((value) => value === null || value.length <= 50, {
    message: "Barcode must be 50 characters or less",
  })
  .refine((value) => !isReservedProductBarcode(value), {
    message: "This barcode is reserved for system use",
  });

