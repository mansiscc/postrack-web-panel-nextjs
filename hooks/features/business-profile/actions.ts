"use server";

import { revalidatePath } from "next/cache";

import { businessProfileSchema } from "@/hooks/features/business-profile/schema";
import { requireAdminOrManager } from "@/lib/auth/guards";
import { requireModuleAccess } from "@/lib/auth/session";
import { saveBusinessProfile } from "@/services/business-profile.service";
import { actionError, actionSuccess, type ActionResult } from "@/utils/action-result";
import { getErrorMessage } from "@/utils/errors";

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
      logoUrl: data.logoUrl || null,
    });

    revalidatePath("/settings/business-profile");
    revalidatePath("/", "layout");
    return actionSuccess(undefined);
  } catch (error) {
    return actionError(getErrorMessage(error));
  }
}
