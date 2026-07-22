"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Download, Receipt } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { exportSalesListCsvAction } from "@/features/analytics/actions";

import { BillDetailSheet } from "@/features/sales/components/bill-detail-sheet";
import type { SalesListItem } from "@/features/sales/types";
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
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { formatCurrency } from "@/utils/currency";
import { downloadCsv } from "@/utils/csv";
import { formatDateTime } from "@/utils/date";
import { Button } from "@/components/ui/button";

type SalesTableProps = {
  sales: SalesListItem[];
  total: number;
  canExport?: boolean;
};

export function SalesTable({ sales, total, canExport = false }: SalesTableProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [selected, setSelected] = useState<SalesListItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return sales.filter((item) => {
      const matchesSearch =
        !term ||
        (item.billNumber?.toLowerCase().includes(term) ?? false) ||
        item.customerName.toLowerCase().includes(term) ||
        item.customerPhone.includes(term);
      const matchesStatus = status === "all" || item.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [sales, search, status]);

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
          <button
            type="button"
            className="font-medium hover:underline"
            onClick={() => {
              setSelected(row.original);
              setDetailOpen(true);
            }}
          >
            {row.original.billNumber ?? "—"}
          </button>
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
          <DataTableColumnHeader
            column={column}
            title="Amount"
            className="justify-end"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums">
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
          value={search}
          onChange={setSearch}
          placeholder="Search bill, customer, phone…"
        />
        <Select value={status} onValueChange={setStatus}>
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

      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No sales found"
          description="Completed bills will appear here after POS billing."
        />
      ) : (
        <>
          <DataTable columns={columns} data={filtered} />
          <DataTablePagination
            page={1}
            pageSize={DEFAULT_PAGE_SIZE}
            total={total}
            onPageChange={() => {}}
          />
        </>
      )}

      <BillDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        sale={selected}
      />
    </>
  );
}
