import { endOfDay, format, startOfDay } from "date-fns";

import { getDashboardTotals } from "@/repositories/dashboard.repository";
import { createClient } from "@/lib/supabase/server";

export async function getTodayDashboard() {
  const supabase = await createClient();
  const now = new Date();
  const start = startOfDay(now).toISOString();
  const end = endOfDay(now).toISOString();
  const today = format(now, "yyyy-MM-dd");

  return getDashboardTotals(supabase, { start, end, today });
}
