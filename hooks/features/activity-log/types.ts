import type { ActivityLogRow } from "@/repositories/activity-log.repository";
import { formatDateTime } from "@/utils/date";

export type ActivityLogItem = {
  id: string;
  createdAt: string;
  userName: string;
  actionType: ActivityLogRow["action_type"];
  moduleName: string;
  description: string;
  status: ActivityLogRow["status"];
  recordId: string | null;
};

export function mapActivityLogRow(row: ActivityLogRow): ActivityLogItem {
  return {
    id: row.id,
    createdAt: row.created_at,
    userName: row.user_name,
    actionType: row.action_type,
    moduleName: row.module_name,
    description: row.description,
    status: row.status,
    recordId: row.record_id,
  };
}

export function activityLogsToCsv(items: ActivityLogItem[]): string {
  const header = [
    "Timestamp",
    "User",
    "Action",
    "Module",
    "Description",
    "Status",
    "Record ID",
  ];

  const rows = items.map((item) => [
    formatDateTime(item.createdAt),
    item.userName,
    item.actionType,
    item.moduleName,
    `"${item.description.replace(/"/g, '""')}"`,
    item.status,
    item.recordId ?? "",
  ]);

  return [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
}
