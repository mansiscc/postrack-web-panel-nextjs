import { ActivityLogTable } from "@/hooks/features/activity-log/components/activity-log-table";
import { requireModuleAccess } from "@/lib/auth/session";
import {
  getActivityLogFilterOptions,
  getActivityLogs,
} from "@/services/activity-log.service";
import { PageHeader } from "@/components/layout/page-header";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

export default async function ActivityLogPage() {
  await requireModuleAccess("activity-log");

  const [{ items, total }, filterOptions] = await Promise.all([
    getActivityLogs({ page: 1, pageSize: DEFAULT_PAGE_SIZE }),
    getActivityLogFilterOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Activity log"
        description="Audit trail of store actions and authentication events."
      />
      <ActivityLogTable
        initialItems={items}
        initialTotal={total}
        users={filterOptions.users}
        modules={filterOptions.modules}
      />
    </>
  );
}
