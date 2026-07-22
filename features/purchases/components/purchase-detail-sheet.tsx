"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { getPurchaseDetailsAction } from "@/features/purchases/actions";
import type { PurchaseListItem } from "@/features/purchases/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCurrency, formatNumber } from "@/utils/currency";
import { formatDate, formatDateTime } from "@/utils/date";
import type { ColumnDef } from "@tanstack/react-table";
import type { StockInItemDetail } from "@/repositories/stock-in.repository";

type PurchaseDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: PurchaseListItem | null;
};

export function PurchaseDetailSheet({
  open,
  onOpenChange,
  purchase,
}: PurchaseDetailSheetProps) {
  const [items, setItems] = useState<StockInItemDetail[]>([]);
  const [meta, setMeta] = useState<{
    supplierName: string;
    accountName: string | null;
    notes: string | null;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !purchase) {
      setItems([]);
      setMeta(null);
      return;
    }

    startTransition(async () => {
      const result = await getPurchaseDetailsAction(purchase.id);
      if (!result) return;
      setItems(result.items);
      setMeta({
        supplierName: result.supplierName,
        accountName: result.accountName,
        notes: result.header.notes,
      });
    });
  }, [open, purchase]);

  const columns: ColumnDef<StockInItemDetail>[] = [
    {
      accessorKey: "product_name",
      header: "Product",
    },
    {
      accessorKey: "batch_name",
      header: "Batch",
      cell: ({ row }) => row.original.batch_name ?? "—",
    },
    {
      accessorKey: "quantity",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Qty"
          className="justify-end"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {formatNumber(row.original.quantity)}
        </div>
      ),
    },
    {
      accessorKey: "purchase_price",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Purchase"
          className="justify-end"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {formatCurrency(row.original.purchase_price)}
        </div>
      ),
    },
    {
      accessorKey: "row_total",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Total"
          className="justify-end"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {formatCurrency(row.original.row_total)}
        </div>
      ),
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-150">
        <SheetHeader className="border-b pb-4">
          <SheetTitle>
            {purchase?.invoiceNumber || "Purchase detail"}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {purchase ? formatDate(purchase.date) : ""}
            {meta ? ` · ${meta.supplierName}` : ""}
          </p>
        </SheetHeader>

        {isPending ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto px-4 py-4">
            <div className="grid gap-2 text-sm">
              <p>
                <span className="text-muted-foreground">Account:</span>{" "}
                {meta?.accountName ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Recorded:</span>{" "}
                {purchase ? formatDateTime(purchase.createdAt) : "—"}
              </p>
              {meta?.notes ? (
                <p>
                  <span className="text-muted-foreground">Notes:</span>{" "}
                  {meta.notes}
                </p>
              ) : null}
            </div>
            <DataTable columns={columns} data={items} />
            <div className="flex justify-end border-t pt-4 text-sm font-medium">
              Grand total: {formatCurrency(purchase?.totalAmount)}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
