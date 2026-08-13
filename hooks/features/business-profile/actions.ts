"use server";

import { revalidatePath } from "next/cache";

import { businessProfileSchema } from "@/hooks/features/business-profile/schema";
import { requireAdminOrManager } from "@/lib/auth/guards";
import { requireModuleAccess } from "@/lib/auth/session";
import { saveBusinessProfile } from "@/services/business-profile.service";
import { actionError, actionSuccess, type ActionResult } from "@/utils/action-result";
import { AppError, getErrorMessage } from "@/utils/errors";

function requireStoredLogoUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return url.trim();
    }
  } catch {
    // fall through
  }
  throw new AppError("Logo must be uploaded before saving");
}

export async function updateBusinessProfileAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireAdminOrManager();
    await requireModuleAccess("business-profile");

    const parsed = businessProfileSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const data = parsed.data;
    await saveBusinessProfile(user, {
      businessName: data.businessName,
      businessCategory: data.businessCategory || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      gstin: data.gstin || null,
      invoicePrefix: data.invoicePrefix,
      receiptFooter: data.receiptFooter || null,
      showLogoOnBill: data.showLogoOnBill,
      logoUrl: requireStoredLogoUrl(data.logoUrl),
    });

    revalidatePath("/settings/business-profile");
    revalidatePath("/", "layout");
    return actionSuccess(undefined);
  } catch (error) {
    if (error instanceof AppError) return actionError(error.message);
    return actionError(getErrorMessage(error));
  }
}
