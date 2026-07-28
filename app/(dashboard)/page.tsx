import { format } from "date-fns";

import { DashboardPanel } from "@/hooks/features/dashboard/components/dashboard-panel";
import { requireModuleAccess } from "@/lib/auth/session";
import { getTodayDashboard } from "@/services/dashboard.service";

export default async function DashboardPage() {
  await requireModuleAccess("dashboard");
  const totals = await getTodayDashboard();
  const todayLabel = `Today, ${format(new Date(), "dd MMM yyyy")}`;

  return <DashboardPanel totals={totals} todayLabel={todayLabel} />;
}
