"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus, ShoppingBag } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

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
import type { AccountRow } from "@/repositories/accounts.repository";
import type { ProductListRow } from "@/repositories/products.repository";
import type { SupplierListRow } from "@/repositories/suppliers.repository";
import { formatCurrency, formatNumber } from "@/utils/currency";
import { formatDate } from "@/utils/date";
import { buildQueryString } from "@/utils/url-query";

type PurchaseFilters = {
  search: string;
};

type PurchaseTableProps = {
  purchases: PurchaseListItem[];
  total: number;
  page: number;
  pageSize: number;
  filters: PurchaseFilters;
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
  page,
  pageSize,
  filters,
  formOptions,
}: PurchaseTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<PurchaseListItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const pushFilters = (
    patch: Partial<PurchaseFilters & { page: number; pageSize: number }>,
  ) => {
    const next = {
      q: patch.search ?? filters.search,
      page: patch.page ?? page,
      pageSize: patch.pageSize ?? pageSize,
    };
    if (patch.search !== undefined) {
      next.page = 1;
    }
    startTransition(() => {
      router.push(`${pathname}${buildQueryString(next)}`);
    });
  };

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
          value={filters.search}
          onChange={(value) => pushFilters({ search: value })}
          placeholder="Search invoice or supplier…"
        />
      </DataTableToolbar>

      {purchases.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No purchases found"
          description={
            filters.search
              ? "No purchases match your current search."
              : "Record your first stock-in entry to update inventory."
          }
          action={
            filters.search ? undefined : (
              <Button type="button" onClick={() => setFormOpen(true)}>
                <Plus />
                New purchase
              </Button>
            )
          }
        />
      ) : (
        <div className={isPending ? "opacity-60 transition-opacity" : undefined}>
          <DataTable
            columns={columns}
            data={purchases}
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
