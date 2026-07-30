"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";

import { PurchaseDetailSheet } from "@/hooks/features/purchases/components/purchase-detail-sheet";
import { PurchaseFormSheet } from "@/hooks/features/purchases/components/purchase-form-sheet";
import type { PurchaseListItem } from "@/hooks/features/purchases/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTablePagination } from "@/components/data-table/pagination";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/feedback/empty-state";
import { SearchInput } from "@/components/forms/search-input";
import { Button } from "@/components/ui/button";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import type { AccountRow } from "@/repositories/accounts.repository";
import type { ProductListRow } from "@/repositories/products.repository";
import type { SupplierListRow } from "@/repositories/suppliers.repository";
import { formatCurrency, formatNumber } from "@/utils/currency";
import { formatDate } from "@/utils/date";

type PurchaseTableProps = {
  purchases: PurchaseListItem[];
  total: number;
  formOptions: {
    suppliers: SupplierListRow[];
    products: ProductListRow[];
    accounts: AccountRow[];
    defaultAccountId: string | null;
  };
};

export function PurchaseTable({
  purchases,
  total,
  formOptions,
}: PurchaseTableProps) {
  const [items] = useState(purchases);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PurchaseListItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

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
          <span className="font-medium">
            {row.original.invoiceNumber || "—"}
          </span>
        ),
      },
      {
        accessorKey: "supplierName",
        header: "Supplier",
      },
      {
        accessorKey: "totalItems",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Items" />
        ),
        cell: ({ row }) => (
          <div className="tabular-nums">
            {formatNumber(row.original.totalItems)}
          </div>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Amount" />
        ),
        cell: ({ row }) => (
          <div className="tabular-nums font-medium">
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

  return (
    <>
      <DataTableToolbar
        actions={
          <Button type="button" onClick={() => setFormOpen(true)}>
            <Plus />
            New purchase
          </Button>
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
            <Button type="button" onClick={() => setFormOpen(true)}>
              <Plus />
              New purchase
            </Button>
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(row) => {
              setSelected(row);
              setDetailOpen(true);
            }}
          />
          <DataTablePagination
            page={1}
            pageSize={DEFAULT_PAGE_SIZE}
            total={total}
            onPageChange={() => {}}
          />
        </>
      )}

      <PurchaseFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        suppliers={formOptions.suppliers}
        products={formOptions.products}
        accounts={formOptions.accounts}
        defaultAccountId={formOptions.defaultAccountId}
      />

      <PurchaseDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        purchase={selected}
      />
    </>
  );
}
