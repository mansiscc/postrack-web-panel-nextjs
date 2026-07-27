"use client";

import { Banknote, Loader2, Printer, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import { useTableRefresh } from "@/hooks/use-table-refresh";
import { toast } from "sonner";

import {
  completePaymentAction,
  getBillDetailAction,
  processReturnAction,
} from "@/hooks/features/billing/actions";
import type { SalesListItem } from "@/hooks/features/sales/types";
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
  ModalCard,
  ModalCardBody,
  ModalCardContent,
  ModalCardHeader,
  ModalCardTitle,
} from "@/components/ui/modal-card";
import type { AccountRow } from "@/repositories/accounts.repository";
import type {
  BillItemRow,
  BillReturnRow,
  BillRow,
} from "@/repositories/bills.repository";
import {
  calculateRefundPayableNow,
} from "@/utils/billing-calculator";
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
  accounts: AccountRow[];
  defaultAccountId: string | null;
};

export function BillDetailSheet({
  open,
  onOpenChange,
  sale,
  accounts,
  defaultAccountId,
}: BillDetailSheetProps) {
  const refresh = useTableRefresh();
  const [bill, setBill] = useState<BillRow | null>(null);
  const [items, setItems] = useState<BillItemWithReturnable[]>([]);
  const [returns, setReturns] = useState<BillReturnRow[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [totalReturnedAmount, setTotalReturnedAmount] = useState(0);
  const [alreadyRefunded, setAlreadyRefunded] = useState(0);
  const [remainingDue, setRemainingDue] = useState(0);
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>(
    {},
  );
  const [refundMethod, setRefundMethod] = useState<
    "Cash" | "UPI" | "Card" | "Mixed"
  >("Cash");
  const [refundAccountId, setRefundAccountId] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isReturning, startReturn] = useTransition();
  const [isCollecting, startCollect] = useTransition();

  useEffect(() => {
    if (!open || !sale) {
      setBill(null);
      setItems([]);
      setReturns([]);
      return;
    }

    setRefundAccountId(defaultAccountId ?? accounts[0]?.id ?? "");

    startTransition(async () => {
      const result = await getBillDetailAction(sale.id);
      if (!result) return;
      setBill(result.bill);
      setItems(result.items);
      setReturns(result.returns);
      setCustomerName(result.customerName);
      setTotalReturnedAmount(result.totalReturnedAmount);
      setAlreadyRefunded(result.alreadyRefunded);
      setRemainingDue(result.remainingDue);
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
      setReturnNote("");
    });
  }, [open, sale, defaultAccountId, accounts]);

  const thisReturnAmount = useMemo(() => {
    return Number(
      items
        .filter(
          (item) => selectedItems[item.id] && (returnQty[item.id] ?? 0) > 0,
        )
        .reduce(
          (sum, item) =>
            sum + item.unit_price * (returnQty[item.id] ?? 0),
          0,
        )
        .toFixed(2),
    );
  }, [items, selectedItems, returnQty]);

  const refundPayableNow = useMemo(() => {
    if (!bill || thisReturnAmount <= 0) return 0;
    return calculateRefundPayableNow({
      totalPayable: bill.total_payable_amount,
      receivedAmount: bill.received_amount_total,
      previousReturnedAmount: totalReturnedAmount,
      thisReturnAmount,
      alreadyRefunded,
    });
  }, [bill, thisReturnAmount, totalReturnedAmount, alreadyRefunded]);

  const canCompletePayment =
    Boolean(bill) &&
    remainingDue > 0 &&
    (bill?.status === "PENDING" ||
      bill?.status === "PARTIALLY_PAID" ||
      bill?.status === "PARTIAL_RETURN");

  const reloadDetail = async (billId: string) => {
    const result = await getBillDetailAction(billId);
    if (!result) return;
    setBill(result.bill);
    setItems(result.items);
    setReturns(result.returns);
    setCustomerName(result.customerName);
    setTotalReturnedAmount(result.totalReturnedAmount);
    setAlreadyRefunded(result.alreadyRefunded);
    setRemainingDue(result.remainingDue);
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
  };

  const handleReturn = () => {
    if (!sale) return;
    if (!refundAccountId) {
      toast.error("Select a refund account");
      return;
    }

    const returnItems = items
      .filter((item) => selectedItems[item.id] && (returnQty[item.id] ?? 0) > 0)
      .map((item) => ({
        billItemId: item.id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: returnQty[item.id] ?? 0,
        unitPrice: item.unit_price,
      }));

    if (!returnItems.length) {
      toast.error("Select at least one item to return");
      return;
    }

    startReturn(async () => {
      const result = await processReturnAction({
        billId: sale.id,
        refundMethod,
        refundAccountId,
        returnNote: returnNote || null,
        items: returnItems,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const refundMsg =
        result.data.refundAmount > 0
          ? ` · refund ${formatCurrency(result.data.refundAmount)}`
          : " · no cash refund (unpaid balance)";
      toast.success(`Return ${result.data.returnNumber}${refundMsg}`);
      await reloadDetail(sale.id);
      refresh();
    });
  };

  const handleCompletePayment = () => {
    if (!sale) return;
    startCollect(async () => {
      const result = await completePaymentAction({
        billId: sale.id,
        accountId: defaultAccountId ?? accounts[0]?.id ?? null,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Collected ${formatCurrency(result.data.collectedAmount)}`,
      );
      await reloadDetail(sale.id);
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
    <ModalCard open={open} onOpenChange={onOpenChange}>
      <ModalCardContent size="xl">
        <ModalCardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <ModalCardTitle>{sale?.billNumber ?? "Bill detail"}</ModalCardTitle>
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
        </ModalCardHeader>

        {isPending ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ModalCardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status="active"
                label={bill?.status ?? sale?.status ?? ""}
              />
              <span className="text-sm text-muted-foreground">
                {bill?.payment_mode ?? sale?.paymentMode}
              </span>
            </div>

            {bill ? (
              <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryTile
                  label="Payable"
                  value={formatCurrency(bill.total_payable_amount)}
                />
                <SummaryTile
                  label="Received"
                  value={formatCurrency(bill.received_amount_total)}
                />
                <SummaryTile
                  label="Returned"
                  value={formatCurrency(totalReturnedAmount)}
                />
                <SummaryTile
                  label={remainingDue > 0 ? "Due" : "Change"}
                  value={formatCurrency(Math.abs(remainingDue))}
                  tone={remainingDue > 0 ? "danger" : "muted"}
                />
              </div>
            ) : null}

            {canCompletePayment ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Outstanding balance</p>
                  <p className="text-xs text-muted-foreground">
                    Collect {formatCurrency(remainingDue)} and mark as paid
                  </p>
                </div>
                <Button
                  type="button"
                  disabled={isCollecting}
                  onClick={handleCompletePayment}
                >
                  {isCollecting ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Collecting…
                    </>
                  ) : (
                    <>
                      <Banknote />
                      Complete payment
                    </>
                  )}
                </Button>
              </div>
            ) : null}

            <DataTable columns={itemColumns} data={items} />

            {returns.length > 0 ? (
              <div className="space-y-2 rounded-lg border border-border p-4">
                <h3 className="text-sm font-medium">Return history</h3>
                <ul className="space-y-2">
                  {returns.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span className="font-medium">{row.return_number}</span>
                      <span className="text-muted-foreground">
                        {formatDateTime(row.created_at)} · {row.refund_method}
                      </span>
                      <span className="tabular-nums">
                        {formatCurrency(row.total_return_amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {items.some((item) => item.returnableQty > 0) ? (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <RotateCcw className="size-4" />
                  Process return
                </h3>
                {items
                  .filter((item) => item.returnableQty > 0)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
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
                    <Label>Refund account</Label>
                    <Select
                      value={refundAccountId}
                      onValueChange={setRefundAccountId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Note</Label>
                    <Input
                      value={returnNote}
                      onChange={(event) => setReturnNote(event.target.value)}
                    />
                  </div>
                </div>
                {thisReturnAmount > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Return total {formatCurrency(thisReturnAmount)} · cash
                    refund {formatCurrency(refundPayableNow)}
                    {refundPayableNow === 0
                      ? " (no overpayment to refund)"
                      : null}
                  </p>
                ) : null}
                <Button
                  type="button"
                  disabled={isReturning || !refundAccountId}
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
          </ModalCardBody>
        )}
      </ModalCardContent>
    </ModalCard>
  );
}

function SummaryTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "muted";
}) {
  return (
    <div className="rounded-md bg-card px-3 py-2">
      <p className="text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={
          tone === "danger"
            ? "mt-0.5 text-sm font-bold tabular-nums text-destructive"
            : "mt-0.5 text-sm font-bold tabular-nums"
        }
      >
        {value}
      </p>
    </div>
  );
}
