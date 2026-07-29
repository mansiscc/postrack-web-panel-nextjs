import type { ChangeEvent } from "react";
import type { FieldValues, Path, PathValue, UseFormReturn } from "react-hook-form";

import {
  alphanumericOnly,
  barcodeOnly,
  decimalOnly,
  digitsOnly,
  gstinOnly,
  integerOnly,
} from "@/lib/validation/input";

function setFieldValue<T extends FieldValues>(
  form: UseFormReturn<T>,
  name: Path<T>,
  value: string,
) {
  form.setValue(name, value as PathValue<T, Path<T>>, {
    shouldValidate: true,
    shouldDirty: true,
  });
}

export function bindPhoneInput<T extends FieldValues>(
  form: UseFormReturn<T>,
  name: Path<T>,
  options?: { placeholder?: string },
) {
  return {
    inputMode: "numeric" as const,
    maxLength: 10,
    placeholder: options?.placeholder ?? "10-digit mobile",
    autoComplete: "tel",
    ...form.register(name),
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      setFieldValue(form, name, digitsOnly(event.target.value, 10));
    },
  };
}

export function bindIntegerInput<T extends FieldValues>(
  form: UseFormReturn<T>,
  name: Path<T>,
  options?: { maxLength?: number; placeholder?: string },
) {
  return {
    inputMode: "numeric" as const,
    placeholder: options?.placeholder,
    maxLength: options?.maxLength,
    ...form.register(name),
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      setFieldValue(
        form,
        name,
        integerOnly(event.target.value, options?.maxLength),
      );
    },
  };
}

export function bindDecimalInput<T extends FieldValues>(
  form: UseFormReturn<T>,
  name: Path<T>,
  options?: { placeholder?: string },
) {
  return {
    inputMode: "decimal" as const,
    placeholder: options?.placeholder ?? "0.00",
    ...form.register(name),
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      setFieldValue(form, name, decimalOnly(event.target.value));
    },
  };
}

export function bindAlphanumericInput<T extends FieldValues>(
  form: UseFormReturn<T>,
  name: Path<T>,
  options?: { maxLength?: number; placeholder?: string },
) {
  return {
    placeholder: options?.placeholder,
    maxLength: options?.maxLength,
    ...form.register(name),
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      setFieldValue(
        form,
        name,
        alphanumericOnly(event.target.value, options?.maxLength),
      );
    },
  };
}

export function bindEmailInput<T extends FieldValues>(
  form: UseFormReturn<T>,
  name: Path<T>,
) {
  return {
    type: "email" as const,
    autoComplete: "email",
    ...form.register(name),
  };
}

export function bindGstinInput<T extends FieldValues>(
  form: UseFormReturn<T>,
  name: Path<T>,
  options?: { maxLength?: number; placeholder?: string },
) {
  const maxLength = options?.maxLength ?? 15;
  return {
    placeholder: options?.placeholder ?? "Optional",
    maxLength,
    ...form.register(name),
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      setFieldValue(form, name, gstinOnly(event.target.value, maxLength));
    },
  };
}

export function bindBarcodeInput<T extends FieldValues>(
  form: UseFormReturn<T>,
  name: Path<T>,
  options?: { placeholder?: string },
) {
  return {
    placeholder: options?.placeholder ?? "Barcode (optional)",
    maxLength: 50,
    autoComplete: "off",
    ...form.register(name),
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      setFieldValue(form, name, barcodeOnly(event.target.value));
    },
  };
}

/** For uncontrolled React state (purchase form, etc.). */
export function onPhoneChange(
  value: string,
  setter: (value: string) => void,
) {
  setter(digitsOnly(value, 10));
}

export function onIntegerChange(
  value: string,
  setter: (value: string) => void,
) {
  setter(integerOnly(value));
}

export function onDecimalChange(
  value: string,
  setter: (value: string) => void,
) {
  setter(decimalOnly(value));
}
