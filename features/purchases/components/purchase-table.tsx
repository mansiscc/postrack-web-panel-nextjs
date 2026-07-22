"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Download, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { exportPurchasesListCsvAction } from "@/features/analytics/actions";

import { PurchaseDetailSheet } from "@/features/purchases/components/purchase-detail-sheet";
import type { PurchaseListItem } from "@/features/purchases/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTablePagination } from "@/components/data-table/pagination";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/feedback/empty-state";
import { SearchInput } from "@/components/forms/search-input";
import { Button } from "@/components/ui/button";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { formatCurrency, formatNumber } from "@/utils/currency";
import { formatDate } from "@/utils/date";
import { downloadCsv } from "@/utils/csv";

type PurchaseTableProps = {
  purchases: PurchaseListItem[];
  total: number;
  canExport?: boolean;
};

export function PurchaseTable({
  purchases,
  total,
  canExport = false,
}: PurchaseTableProps) {
  const [items] = useState(purchases);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PurchaseListItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return items.filter(
      (item) =>
        !term ||
        (item.invoiceNumber?.toLowerCase().includes(term) ?? false) ||
        item.supplierName.toLowerCase().includes(term) ||
        (item.notes?.toLowerCase().includes(term) ?? false),
    );
  }, [items, search]);

  const columns = useMemo<ColumnDef<PurchaseListItem>[]>(
    () => [
      {
        accessorKey: "date",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => formatDate(row.original.date),
      },
      {
        accessorKey: "invoiceNumber",
        header: "Invoice",
        cell: ({ row }) => (
          <button
            type="button"
            className="text-left font-medium hover:underline"
            onClick={() => {
              setSelected(row.original);
              setDetailOpen(true);
            }}
          >
            {row.original.invoiceNumber || "—"}
          </button>
        ),
      },
      {
        accessorKey: "supplierName",
        header: "Supplier",
      },
      {
        accessorKey: "totalItems",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Items"
            className="justify-end"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {formatNumber(row.original.totalItems)}
          </div>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Amount"
            className="justify-end"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums font-medium">
            {formatCurrency(row.original.totalAmount)}
          </div>
        ),
      },
      {
        accessorKey: "createdByName",
        header: "Created by",
        cell: ({ row }) => row.original.createdByName ?? "—",
      },
    ],
    [],
  );

  const handleExport = async () => {
    const result = await exportPurchasesListCsvAction();
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
          <>
            {canExport && (
              <Button type="button" variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            )}
            <Button type="button" asChild>
              <Link href="/purchases/new">
                <Plus />
                New purchase
              </Link>
            </Button>
          </>
        }
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search invoice or supplier…"
        />
      </DataTableToolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No purchases found"
          description="Record your first stock-in entry to update inventory."
          action={
            <Button type="button" asChild>
              <Link href="/purchases/new">
                <Plus />
                New purchase
              </Link>
            </Button>
          }
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

      <PurchaseDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        purchase={selected}
      />
    </>
  );
}
