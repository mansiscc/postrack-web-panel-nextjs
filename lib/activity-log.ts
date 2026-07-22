import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type ActivityPayload = {
  userId: string;
  userName: string;
  companyId: string;
  actionType: "Create" | "Update" | "Delete" | "Login" | "Logout";
  moduleName: string;
  description: string;
  status: "Success" | "Failed";
  recordId?: string;
  ipAddress?: string;
};

export async function logActivity(
  supabase: SupabaseClient<Database>,
  payload: ActivityPayload,
): Promise<void> {
  const { error } = await supabase.from("activity_log").insert({
    company_id: payload.companyId,
    user_id: payload.userId,
    user_name: payload.userName,
    action_type: payload.actionType,
    module_name: payload.moduleName,
    description: payload.description,
    status: payload.status,
    record_id: payload.recordId ?? null,
    ip_address: payload.ipAddress ?? null,
  });

  if (error) {
    console.error("Failed to write activity log:", error.message);
  }
}
