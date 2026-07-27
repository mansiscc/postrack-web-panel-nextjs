"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Download, Receipt } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { exportSalesListCsvAction } from "@/hooks/features/analytics/actions";
import { BillDetailSheet } from "@/hooks/features/sales/components/bill-detail-sheet";
import type { SalesListItem } from "@/hooks/features/sales/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTablePagination } from "@/components/data-table/pagination";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/feedback/empty-state";
import { SearchInput } from "@/components/forms/search-input";
import { StatusBadge } from "@/components/forms/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AccountRow } from "@/repositories/accounts.repository";
import { formatCurrency } from "@/utils/currency";
import { downloadCsv } from "@/utils/csv";
import { formatDateTime } from "@/utils/date";
import { buildQueryString, type SalesDateFilter } from "@/utils/url-query";
import { Button } from "@/components/ui/button";

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
  canExport?: boolean;
  accounts: AccountRow[];
  defaultAccountId: string | null;
};

export function SalesTable({
  sales,
  total,
  page,
  pageSize,
  filters,
  canExport = false,
  accounts,
  defaultAccountId,
}: SalesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<SalesListItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const pushFilters = (patch: Partial<SalesFilters & { page: number; pageSize: number }>) => {
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
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => formatDateTime(row.original.createdAt),
      },
      {
        accessorKey: "billNumber",
        header: "Bill #",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.billNumber ?? "—"}</span>
        ),
      },
      {
        accessorKey: "customerName",
        header: "Customer",
      },
      {
        accessorKey: "paymentMode",
        header: "Payment",
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
          <StatusBadge status="active" label={row.original.status} />
        ),
      },
    ],
    [],
  );

  const handleExport = async () => {
    const result = await exportSalesListCsvAction();
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    downloadCsv(result.data.filename, result.data.csv);
  };

  return (
    <>
      <DataTableToolbar
        actions={
          canExport ? (
            <Button type="button" variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          ) : undefined
        }
      >
        <SearchInput
          value={filters.search}
          onChange={(value) => pushFilters({ search: value })}
          placeholder="Search bill, customer, phone…"
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
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="PARTIALLY_PAID">Partially paid</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="RETURNED">Returned</SelectItem>
            <SelectItem value="PARTIAL_RETURN">Partial return</SelectItem>
          </SelectContent>
        </Select>
      </DataTableToolbar>

      {sales.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No sales found"
          description="Completed bills will appear here after POS billing."
        />
      ) : (
        <div className={isPending ? "opacity-60 transition-opacity" : undefined}>
          <DataTable
            columns={columns}
            data={sales}
            onRowClick={(row) => {
              setSelected(row);
              setDetailOpen(true);
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

      <BillDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        sale={selected}
        accounts={accounts}
        defaultAccountId={defaultAccountId}
      />
    </>
  );
}
