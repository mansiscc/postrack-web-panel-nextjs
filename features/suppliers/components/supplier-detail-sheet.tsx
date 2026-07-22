"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { getSupplierDetailsAction } from "@/features/suppliers/actions";
import type { SupplierListItem } from "@/features/suppliers/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCurrency, formatNumber } from "@/utils/currency";
import { formatDate } from "@/utils/date";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";

type SupplierPurchase = {
  id: string;
  date: string;
  invoice_number: string | null;
  total_items: number;
  total_amount: number;
  created_at: string;
  created_by_name: string | null;
};

type SupplierDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: SupplierListItem | null;
  onEdit: (supplier: SupplierListItem) => void;
};

export function SupplierDetailSheet({
  open,
  onOpenChange,
  supplier,
  onEdit,
}: SupplierDetailSheetProps) {
  const [purchases, setPurchases] = useState<SupplierPurchase[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !supplier) {
      setPurchases([]);
      return;
    }

    startTransition(async () => {
      const result = await getSupplierDetailsAction(supplier.id);
      setPurchases(result.purchases as SupplierPurchase[]);
    });
  }, [open, supplier]);

  const columns: ColumnDef<SupplierPurchase>[] = [
    {
      accessorKey: "date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      accessorKey: "invoice_number",
      header: "Invoice",
      cell: ({ row }) => row.original.invoice_number ?? "—",
    },
    {
      accessorKey: "total_items",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Items"
          className="justify-end"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {formatNumber(row.original.total_items)}
        </div>
      ),
    },
    {
      accessorKey: "total_amount",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Amount"
          className="justify-end"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {formatCurrency(row.original.total_amount)}
        </div>
      ),
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-150">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle>{supplier?.supplierName}</SheetTitle>
              <p className="text-sm text-muted-foreground">
                {supplier?.phone || "No phone"}
                {supplier?.email ? ` · ${supplier.email}` : ""}
              </p>
            </div>
            {supplier ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(supplier);
                }}
              >
                <Pencil />
                Edit
              </Button>
            ) : null}
          </div>
        </SheetHeader>

        <div className="space-y-4 overflow-y-auto px-4 py-4">
          <div className="grid gap-2 text-sm">
            <p>
              <span className="text-muted-foreground">Contact:</span>{" "}
              {supplier?.contactPerson || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">GST:</span>{" "}
              {supplier?.gstNumber || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Purchases:</span>{" "}
              {supplier?.purchaseCount ?? 0}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Purchase history</h3>
            {isPending ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No purchases recorded for this supplier yet.
              </p>
            ) : (
              <DataTable columns={columns} data={purchases} />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
