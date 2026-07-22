import {
  listActivityLogModules,
  listActivityLogs,
  listActivityLogUsers,
  type ActivityLogFilters,
} from "@/repositories/activity-log.repository";
import { createClient } from "@/lib/supabase/server";

export async function getActivityLogs(filters: ActivityLogFilters) {
  const supabase = await createClient();
  return listActivityLogs(supabase, filters);
}

export async function getActivityLogFilterOptions() {
  const supabase = await createClient();
  const [users, modules] = await Promise.all([
    listActivityLogUsers(supabase),
    listActivityLogModules(supabase),
  ]);
  return { users, modules };
}
