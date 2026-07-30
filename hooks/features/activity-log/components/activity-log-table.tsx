"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  mapActivityLogRow,
  type ActivityLogItem,
} from "@/hooks/features/activity-log/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTablePagination } from "@/components/data-table/pagination";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/forms/status-badge";
import { SearchInput } from "@/components/forms/search-input";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { formatDateTime } from "@/utils/date";
import { ScrollText } from "lucide-react";
import type { ActivityLogRow } from "@/repositories/activity-log.repository";

type ActivityLogTableProps = {
  initialItems: ActivityLogRow[];
  initialTotal: number;
  users: Array<{ id: string; full_name: string }>;
  modules: string[];
};

const ACTION_TYPES = ["Create", "Update", "Delete", "Login", "Logout"] as const;

export function ActivityLogTable({
  initialItems,
  initialTotal,
  users,
  modules,
}: ActivityLogTableProps) {
  const [items, setItems] = useState(initialItems.map(mapActivityLogRow));
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionType, setActionType] = useState("all");
  const [moduleName, setModuleName] = useState("all");
  const [status, setStatus] = useState("all");
  const [userId, setUserId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const fetchLogs = (nextPage = page) => {
    startTransition(async () => {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(DEFAULT_PAGE_SIZE),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (actionType !== "all") params.set("actionType", actionType);
      if (moduleName !== "all") params.set("moduleName", moduleName);
      if (status !== "all") params.set("status", status);
      if (userId !== "all") params.set("userId", userId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const response = await fetch(`/api/activity-log?${params.toString()}`);
      if (!response.ok) return;
      const data = (await response.json()) as {
        items: ActivityLogRow[];
        total: number;
      };
      setItems(data.items.map(mapActivityLogRow));
      setTotal(data.total);
      setPage(nextPage);
    });
  };

  useEffect(() => {
    fetchLogs(1);
  }, [debouncedSearch, actionType, moduleName, status, userId, dateFrom, dateTo]);

  const columns = useMemo<ColumnDef<ActivityLogItem>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Timestamp" />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "userName",
        header: "User",
      },
      {
        accessorKey: "actionType",
        header: "Action",
      },
      {
        accessorKey: "moduleName",
        header: "Module",
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="max-w-md truncate">{row.original.description}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status === "Success" ? "paid" : "unpaid"}
            label={row.original.status}
          />
        ),
      },
    ],
    [],
  );

  return (
    <>
      <DataTableToolbar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search description…"
        />
        <Select value={actionType} onValueChange={setActionType}>
          <SelectTrigger className="h-10 w-35">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {ACTION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={moduleName} onValueChange={setModuleName}>
          <SelectTrigger className="h-10 w-40">
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {modules.map((module) => (
              <SelectItem key={module} value={module}>
                {module}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="h-10 w-40">
            <SelectValue placeholder="User" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10 w-32.5">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="Success">Success</SelectItem>
            <SelectItem value="Failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <p className="text-[12px] font-medium text-muted-foreground">From</p>
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="h-10 w-37.5"
            aria-label="From date"
          />
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[12px] font-medium text-muted-foreground">To</p>
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-10 w-37.5"
            aria-label="To date"
          />
        </div>
      </DataTableToolbar>

      {items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No activity recorded"
          description="Actions will appear here as your team uses POSTrack."
        />
      ) : (
        <>
          <DataTable columns={columns} data={items} />
          <DataTablePagination
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            total={total}
            onPageChange={fetchLogs}
          />
        </>
      )}
    </>
  );
}
