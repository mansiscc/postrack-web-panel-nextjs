import { format } from "date-fns";

import { DashboardPanel } from "@/hooks/features/dashboard/components/dashboard-panel";
import { PageHeader } from "@/components/layout/page-header";
import { requireModuleAccess } from "@/lib/auth/session";
import { getTodayDashboard } from "@/services/dashboard.service";

export default async function DashboardPage() {
  await requireModuleAccess("dashboard");
  const totals = await getTodayDashboard();
  const todayLabel = `Today, ${format(new Date(), "dd MMM yyyy")}`;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of sales, inventory, and store performance."
      />
      <DashboardPanel totals={totals} todayLabel={todayLabel} />
    </>
  );
}
