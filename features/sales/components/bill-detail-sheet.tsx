"use client";

import { Loader2, Printer, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { useTableRefresh } from "@/hooks/use-table-refresh";
import { toast } from "sonner";

import {
  getBillDetailAction,
  processReturnAction,
} from "@/features/billing/actions";
import type { SalesListItem } from "@/features/sales/types";
import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/forms/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { BillItemRow, BillRow } from "@/repositories/bills.repository";
import { formatCurrency } from "@/utils/currency";
import { formatDateTime } from "@/utils/date";
import type { ColumnDef } from "@tanstack/react-table";

type BillItemWithReturnable = BillItemRow & {
  returnedQty: number;
  returnableQty: number;
};

type BillDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: SalesListItem | null;
};

export function BillDetailSheet({
  open,
  onOpenChange,
  sale,
}: BillDetailSheetProps) {
  const refresh = useTableRefresh();
  const [bill, setBill] = useState<BillRow | null>(null);
  const [items, setItems] = useState<BillItemWithReturnable[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>(
    {},
  );
  const [refundMethod, setRefundMethod] = useState<
    "Cash" | "UPI" | "Card" | "Mixed"
  >("Cash");
  const [returnNote, setReturnNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isReturning, startReturn] = useTransition();

  useEffect(() => {
    if (!open || !sale) {
      setBill(null);
      setItems([]);
      return;
    }

    startTransition(async () => {
      const result = await getBillDetailAction(sale.id);
      if (!result) return;
      setBill(result.bill);
      setItems(result.items);
      setCustomerName(result.customerName);
      const initialQty: Record<string, number> = {};
      const initialSelected: Record<string, boolean> = {};
      for (const item of result.items) {
        if (item.returnableQty > 0) {
          initialQty[item.id] = 0;
          initialSelected[item.id] = false;
        }
      }
      setReturnQty(initialQty);
      setSelectedItems(initialSelected);
    });
  }, [open, sale]);

  const handleReturn = () => {
    if (!sale) return;
    const returnItems = items
      .filter((item) => selectedItems[item.id] && (returnQty[item.id] ?? 0) > 0)
      .map((item) => ({
        billItemId: item.id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: returnQty[item.id] ?? 0,
        unitPrice: item.unit_price,
      }));

    startReturn(async () => {
      const result = await processReturnAction({
        billId: sale.id,
        refundMethod,
        returnNote: returnNote || null,
        items: returnItems,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(`Return processed (${result.data.returnNumber})`);
      onOpenChange(false);
      refresh();
    });
  };

  const itemColumns: ColumnDef<BillItemWithReturnable>[] = [
    { accessorKey: "product_name", header: "Item" },
    {
      accessorKey: "quantity",
      header: "Sold",
      cell: ({ row }) => row.original.quantity,
    },
    {
      accessorKey: "returnedQty",
      header: "Returned",
      cell: ({ row }) => row.original.returnedQty,
    },
    {
      accessorKey: "unit_price",
      header: "Price",
      cell: ({ row }) => formatCurrency(row.original.unit_price),
    },
    {
      accessorKey: "row_total",
      header: "Total",
      cell: ({ row }) => formatCurrency(row.original.row_total),
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-150">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle>{sale?.billNumber ?? "Bill detail"}</SheetTitle>
              <p className="text-sm text-muted-foreground">
                {customerName} · {sale ? formatDateTime(sale.createdAt) : ""}
              </p>
            </div>
            {sale ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href={`/sales/${sale.id}/receipt`} target="_blank">
                  <Printer />
                  Receipt
                </Link>
              </Button>
            ) : null}
          </div>
        </SheetHeader>

        {isPending ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto px-4 py-4">
            <div className="flex items-center gap-2">
              <StatusBadge status="active" label={bill?.status ?? sale?.status ?? ""} />
              <span className="text-sm text-muted-foreground">
                {bill?.payment_mode ?? sale?.paymentMode}
              </span>
            </div>
            <DataTable columns={itemColumns} data={items} />

            {items.some((item) => item.returnableQty > 0) ? (
              <div className="space-y-3 rounded-lg border p-4">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <RotateCcw className="size-4" />
                  Process return
                </h3>
                {items
                  .filter((item) => item.returnableQty > 0)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-md border px-3 py-2"
                    >
                      <Checkbox
                        checked={selectedItems[item.id] ?? false}
                        onCheckedChange={(checked) =>
                          setSelectedItems((prev) => ({
                            ...prev,
                            [item.id]: Boolean(checked),
                          }))
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Returnable {item.returnableQty}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={item.returnableQty}
                        className="w-20"
                        value={returnQty[item.id] ?? 0}
                        onChange={(event) =>
                          setReturnQty((prev) => ({
                            ...prev,
                            [item.id]: Number(event.target.value || 0),
                          }))
                        }
                      />
                    </div>
                  ))}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Refund method</Label>
                    <Select
                      value={refundMethod}
                      onValueChange={(value) =>
                        setRefundMethod(value as typeof refundMethod)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["Cash", "UPI", "Card", "Mixed"] as const).map(
                          (mode) => (
                            <SelectItem key={mode} value={mode}>
                              {mode}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Note</Label>
                    <Input
                      value={returnNote}
                      onChange={(event) => setReturnNote(event.target.value)}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  disabled={isReturning}
                  onClick={handleReturn}
                >
                  {isReturning ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Processing…
                    </>
                  ) : (
                    "Confirm return"
                  )}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
