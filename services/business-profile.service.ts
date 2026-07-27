import { headers } from "next/headers";

import type { BusinessProfileInput } from "@/hooks/features/business-profile/schema";
import { logActivity } from "@/lib/activity-log";
import {
  getCompanyById,
  updateCompanyProfile,
} from "@/repositories/companies.repository";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/types/auth";

export type { BusinessProfileInput };

export async function getBusinessProfile(companyId: string) {
  const supabase = await createClient();
  return getCompanyById(supabase, companyId);
}

export async function saveBusinessProfile(
  user: SessionUser,
  input: BusinessProfileInput,
) {
  const supabase = await createClient();
  await updateCompanyProfile(supabase, user.companyId, input);

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Update",
    moduleName: "Business Profile",
    description: "Updated business profile",
    status: "Success",
    recordId: user.companyId,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}
