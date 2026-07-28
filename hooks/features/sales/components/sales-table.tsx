"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Receipt } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";

import type { SalesListItem } from "@/hooks/features/sales/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTablePagination } from "@/components/data-table/pagination";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/feedback/empty-state";
import { SearchInput } from "@/components/forms/search-input";
import {
  StatusBadge,
  billStatusLabel,
  billStatusVariant,
} from "@/components/forms/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/utils/currency";
import { formatDateTime } from "@/utils/date";
import { buildQueryString, type SalesDateFilter } from "@/utils/url-query";

type SalesFilters = {
  search: string;
  status: string;
  paymentMode: string;
  date: SalesDateFilter;
};

type SalesTableProps = {
  sales: SalesListItem[];
  total: number;
  page: number;
  pageSize: number;
  filters: SalesFilters;
};

export function SalesTable({
  sales,
  total,
  page,
  pageSize,
  filters,
}: SalesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const pushFilters = (
    patch: Partial<SalesFilters & { page: number; pageSize: number }>,
  ) => {
    const next = {
      q: patch.search ?? filters.search,
      status: patch.status ?? filters.status,
      payment: patch.paymentMode ?? filters.paymentMode,
      date: patch.date ?? filters.date,
      page: patch.page ?? page,
      pageSize: patch.pageSize ?? pageSize,
    };
    if (
      patch.search !== undefined ||
      patch.status !== undefined ||
      patch.paymentMode !== undefined ||
      patch.date !== undefined
    ) {
      next.page = 1;
    }
    startTransition(() => {
      router.push(`${pathname}${buildQueryString(next)}`);
    });
  };

  const columns = useMemo<ColumnDef<SalesListItem>[]>(
    () => [
      {
        accessorKey: "billNumber",
        header: "Bill #",
        cell: ({ row }) => (
          <span className="font-mono text-[13px] font-semibold">
            {row.original.billNumber ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => formatDateTime(row.original.createdAt),
      },
      {
        accessorKey: "customerName",
        header: "Customer",
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.customerName || "Walk-in"}
          </span>
        ),
      },
      {
        accessorKey: "createdByName",
        header: "Created by",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.createdByName?.trim() || "—"}
          </span>
        ),
      },
      {
        accessorKey: "paymentMode",
        header: "Payment",
        cell: ({ row }) => (
          <Badge className="bg-info-muted font-semibold text-info-accent">
            {row.original.paymentMode}
          </Badge>
        ),
      },
      {
        accessorKey: "totalPayableAmount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Amount" />
        ),
        cell: ({ row }) => (
          <div className="font-medium tabular-nums">
            {formatCurrency(row.original.totalPayableAmount)}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={billStatusVariant(row.original.status)}
            label={billStatusLabel(row.original.status)}
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
          value={filters.search}
          onChange={(value) => pushFilters({ search: value })}
          placeholder="Bill no., customer, phone or cashier"
        />
        <Select
          value={filters.date}
          onValueChange={(value) =>
            pushFilters({ date: value as SalesDateFilter })
          }
        >
          <SelectTrigger className="h-10 w-36">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All dates</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="last7">Last 7 days</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.paymentMode}
          onValueChange={(value) => pushFilters({ paymentMode: value })}
        >
          <SelectTrigger className="h-10 w-36">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            <SelectItem value="Cash">Cash</SelectItem>
            <SelectItem value="UPI">UPI</SelectItem>
            <SelectItem value="Card">Card</SelectItem>
            <SelectItem value="Mixed">Mixed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.status}
          onValueChange={(value) => pushFilters({ status: value })}
        >
          <SelectTrigger className="h-10 w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="PAID">PAID</SelectItem>
            <SelectItem value="PARTIALLY_PAID">PARTIAL</SelectItem>
            <SelectItem value="PENDING">PENDING</SelectItem>
            <SelectItem value="RETURNED">RETURNED</SelectItem>
            <SelectItem value="PARTIAL_RETURN">PARTIAL RETURN</SelectItem>
          </SelectContent>
        </Select>
      </DataTableToolbar>

      {sales.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No bills found"
          description={
            filters.search ||
            filters.status !== "all" ||
            filters.paymentMode !== "all" ||
            filters.date !== "all"
              ? "No bills match your current search or filters."
              : "Bills you create will appear here."
          }
        />
      ) : (
        <div className={isPending ? "opacity-60 transition-opacity" : undefined}>
          <DataTable
            columns={columns}
            data={sales}
            onRowClick={(row) => {
              router.push(`/sales/${row.id}`);
            }}
          />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(nextPage) => pushFilters({ page: nextPage })}
            onPageSizeChange={(nextSize) =>
              pushFilters({ pageSize: nextSize, page: 1 })
            }
          />
        </div>
      )}
    </>
  );
}
