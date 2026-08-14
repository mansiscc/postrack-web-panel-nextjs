"use client";

import {
  Banknote,
  ChevronDown,
  ChevronUp,
  Loader2,
  Minus,
  Plus,
  Printer,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  completePaymentAction,
  processReturnAction,
} from "@/hooks/features/billing/actions";
import {
  ReceiptDialog,
  type ReceiptPreviewData,
} from "@/hooks/features/sales/components/receipt-view";
import {
  StatusBadge,
  billStatusLabel,
  billStatusVariant,
} from "@/components/forms/status-badge";
import { useTopbarChrome } from "@/components/layout/topbar-chrome";
import { FormModalCardFooter } from "@/components/forms/form-sheet-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ModalCard,
  ModalCardBody,
  ModalCardContent,
  ModalCardDescription,
  ModalCardHeader,
  ModalCardTitle,
} from "@/components/ui/modal-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AccountRow } from "@/repositories/accounts.repository";
import type {
  BillItemRow,
  BillReturnItemRow,
  BillReturnRow,
  BillRow,
} from "@/repositories/bills.repository";
import { calculateRefundPayableNow } from "@/utils/billing-calculator";
import { formatCurrency } from "@/utils/currency";
import { formatDateTime } from "@/utils/date";

export type BillDetailItem = BillItemRow & {
  returnedQty: number;
  returnableQty: number;
};

export type BillDetailReturn = BillReturnRow & {
  items: BillReturnItemRow[];
};

export type BillDetailsPayload = {
  bill: BillRow;
  items: BillDetailItem[];
  customerName: string;
  customerPhone: string;
  returns: BillDetailReturn[];
  totalReturnedAmount: number;
  alreadyRefunded: number;
  remainingDue: number;
};

type BillDetailsViewProps = {
  detail: BillDetailsPayload;
  accounts: AccountRow[];
  defaultAccountId: string | null;
  businessName?: string | null;
  businessAddress?: string | null;
  businessPhone?: string | null;
  businessGstin?: string | null;
  receiptFooter?: string | null;
  logoUrl?: string | null;
  showLogoOnBill?: boolean;
};

function paymentModeLabel(mode: BillRow["payment_mode"]) {
  return mode === "Mixed" ? "Cash + Online" : mode;
}

function discountLabel(bill: BillRow) {
  if (!bill.discount_amount) return null;
  if (bill.discount_type === "PERCENT" && bill.discount_value != null) {
    return `Discount (${bill.discount_value}%)`;
  }
  return "Discount";
}

function SummaryRow({
  label,
  value,
  valueClassName,
  bold,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span
        className={cn(
          "text-muted-foreground",
          bold && "font-semibold text-foreground",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          bold ? "font-bold text-foreground" : "font-medium",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ReturnModalSectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <CardHeader className="border-b border-border/60 pb-3 pt-4">
        <CardTitle className="text-sm font-bold text-primary">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 pb-4">{children}</CardContent>
    </Card>
  );
}

function ReturnHistoryCard({ entry }: { entry: BillDetailReturn }) {
  const [expanded, setExpanded] = useState(false);
  const itemCount = entry.items.length;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-stretch text-left"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="w-1 shrink-0 bg-primary" />
        <div className="min-w-0 flex-1 space-y-1 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[12px] font-semibold">
              {entry.return_number}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {formatDateTime(entry.created_at)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-primary tabular-nums">
              {formatCurrency(entry.total_return_amount)}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-primary/80">
              {itemCount} item{itemCount === 1 ? "" : "s"}
              {expanded ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </span>
          </div>
        </div>
      </button>

      {entry.return_note?.trim() ? (
        <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <span className="font-semibold">Note:</span> {entry.return_note}
        </div>
      ) : null}

      {expanded && entry.items.length > 0 ? (
        <div className="space-y-2 border-t border-border px-3 py-2.5">
          <div className="flex justify-between text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            <span>Item</span>
            <span>Amount</span>
          </div>
          {entry.items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 text-[12px]"
            >
              <div className="min-w-0">
                <p className="font-medium">{item.product_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {item.quantity} × {formatCurrency(item.unit_price)}
                </p>
              </div>
              <span className="shrink-0 font-medium tabular-nums">
                {formatCurrency(item.line_total)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReturnBillModal({
  open,
  onOpenChange,
  detail,
  accounts,
  defaultAccountId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: BillDetailsPayload;
  accounts: AccountRow[];
  defaultAccountId: string | null;
  onSuccess: () => void;
}) {
  const { bill, items, customerName, totalReturnedAmount, alreadyRefunded } =
    detail;
  const returnableItems = useMemo(
    () => items.filter((item) => item.returnableQty > 0),
    [items],
  );

  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [refundMethod, setRefundMethod] = useState<
    "Cash" | "UPI" | "Card" | "Mixed"
  >("Cash");
  const [refundAccountId, setRefundAccountId] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [isReturning, startReturn] = useTransition();

  useEffect(() => {
    if (!open) return;
    const initial: Record<string, number> = {};
    for (const item of returnableItems) {
      initial[item.id] = 0;
    }
    setReturnQty(initial);
    setRefundMethod("Cash");
    setRefundAccountId(defaultAccountId ?? accounts[0]?.id ?? "");
    setReturnNote("");
  }, [open, returnableItems, defaultAccountId, accounts]);

  const thisReturnAmount = useMemo(() => {
    return Number(
      returnableItems
        .reduce(
          (sum, item) => sum + item.unit_price * (returnQty[item.id] ?? 0),
          0,
        )
        .toFixed(2),
    );
  }, [returnableItems, returnQty]);

  const refundPayableNow = useMemo(() => {
    if (thisReturnAmount <= 0) return 0;
    return calculateRefundPayableNow({
      totalPayable: bill.total_payable_amount,
      receivedAmount: bill.received_amount_total,
      previousReturnedAmount: totalReturnedAmount,
      thisReturnAmount,
      alreadyRefunded,
    });
  }, [
    bill.total_payable_amount,
    bill.received_amount_total,
    thisReturnAmount,
    totalReturnedAmount,
    alreadyRefunded,
  ]);

  const excessReturnAmount = Math.max(
    thisReturnAmount - refundPayableNow,
    0,
  );
  const hasSelectedQty = returnableItems.some(
    (item) => (returnQty[item.id] ?? 0) > 0,
  );

  const setQty = (itemId: string, next: number, max: number) => {
    setReturnQty((prev) => ({
      ...prev,
      [itemId]: Math.min(max, Math.max(0, next)),
    }));
  };

  const handleReturn = () => {
    if (!refundAccountId) {
      toast.error("Select a refund account");
      return;
    }

    const selected = returnableItems
      .filter((item) => (returnQty[item.id] ?? 0) > 0)
      .map((item) => ({
        billItemId: item.id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: returnQty[item.id] ?? 0,
        unitPrice: item.unit_price,
      }));

    if (!selected.length) {
      toast.error("Please select at least one item to return.");
      return;
    }

    startReturn(async () => {
      const result = await processReturnAction({
        billId: bill.id,
        refundMethod,
        refundAccountId,
        returnNote: returnNote || null,
        items: selected,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(
        `Return ${result.data.returnNumber} processed successfully. Stock has been restored.`,
      );
      onOpenChange(false);
      onSuccess();
    });
  };

  return (
    <ModalCard open={open} onOpenChange={onOpenChange}>
      <ModalCardContent size="2xl">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleReturn();
          }}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <ModalCardHeader>
            <ModalCardTitle className="font-mono">
              {bill.bill_number?.trim() || "Return Bill"}
            </ModalCardTitle>
            <ModalCardDescription>
              {formatDateTime(bill.created_at)}
            </ModalCardDescription>
          </ModalCardHeader>

          <ModalCardBody className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)] xl:items-start">
              <div className="grid gap-4">
                <ReturnModalSectionCard title="Return Items">
                  {customerName ? (
                    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-surface-variant/50 px-3 py-2.5 text-[12px]">
                      <span className="text-muted-foreground">Customer</span>
                      <span className="font-medium">{customerName}</span>
                    </div>
                  ) : null}

                  {returnableItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No returnable items on this bill.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {returnableItems.map((item) => {
                        const qty = returnQty[item.id] ?? 0;
                        return (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-surface-variant/30 px-3 py-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium">
                                {item.product_name}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Sold: {item.quantity} · Returned: {item.returnedQty}
                              </p>
                              <p className="mt-1 text-[12px] font-medium tabular-nums">
                                {formatCurrency(item.unit_price)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 rounded-md bg-card p-1 shadow-card-sm">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                disabled={qty <= 0}
                                onClick={() =>
                                  setQty(item.id, qty - 1, item.returnableQty)
                                }
                                aria-label="Decrease return quantity"
                              >
                                <Minus />
                              </Button>
                              <span className="w-8 text-center text-[13px] font-semibold tabular-nums">
                                {qty}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                disabled={qty >= item.returnableQty}
                                onClick={() =>
                                  setQty(item.id, qty + 1, item.returnableQty)
                                }
                                aria-label="Increase return quantity"
                              >
                                <Plus />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ReturnModalSectionCard>
              </div>

              <div className="grid gap-4">
                <ReturnModalSectionCard title="Refund & Note">
                  <div className="grid gap-4">
                    {accounts.length > 0 ? (
                      <div className="space-y-1.5">
                        <Label className="text-[12px] font-semibold">
                          Refund Account
                        </Label>
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
                    ) : null}

                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-semibold">
                        Refund Method
                      </Label>
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

                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-semibold">
                        Return Note
                      </Label>
                      <Input
                        value={returnNote}
                        placeholder="e.g. Damaged product"
                        onChange={(event) => setReturnNote(event.target.value)}
                      />
                    </div>
                  </div>
                </ReturnModalSectionCard>

                <ReturnModalSectionCard title="Summary">
                  {thisReturnAmount > 0 ? (
                    <div className="space-y-2 text-[13px]">
                      <SummaryRow
                        label="Return Amount"
                        value={formatCurrency(thisReturnAmount)}
                        valueClassName="text-primary"
                        bold
                      />
                      <SummaryRow
                        label="Refund Payable Now"
                        value={formatCurrency(refundPayableNow)}
                        valueClassName="text-success-icon"
                        bold
                      />
                      {excessReturnAmount > 0 ? (
                        <SummaryRow
                          label="Unpaid Bill Amount"
                          value={formatCurrency(excessReturnAmount)}
                          valueClassName="text-warning-icon"
                          bold
                        />
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Select item quantities to preview return totals.
                    </p>
                  )}
                </ReturnModalSectionCard>
              </div>
            </div>
          </ModalCardBody>
          <FormModalCardFooter
            onCancel={() => onOpenChange(false)}
            isSubmitting={isReturning}
            submitLabel="Process Return"
            submittingLabel="Processing…"
          />
        </form>
      </ModalCardContent>
    </ModalCard>
  );
}

export function BillDetailsView({
  detail,
  accounts,
  defaultAccountId,
  businessName,
  businessAddress,
  businessPhone,
  businessGstin,
  receiptFooter,
  logoUrl,
  showLogoOnBill = true,
}: BillDetailsViewProps) {
  const router = useRouter();
  const { setChrome, clearChrome } = useTopbarChrome();
  const [returnOpen, setReturnOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [isCollecting, startCollect] = useTransition();

  const {
    bill,
    items,
    returns,
    totalReturnedAmount,
    remainingDue,
  } = detail;

  const canReturn =
    bill.status !== "RETURNED" &&
    items.some((item) => item.returnableQty > 0);

  const canCompletePayment =
    remainingDue > 0 &&
    (bill.status === "PENDING" ||
      bill.status === "PARTIALLY_PAID" ||
      bill.status === "PARTIAL_RETURN");

  const changeGiven = remainingDue < 0 ? Math.abs(remainingDue) : 0;
  const dueAmount = remainingDue > 0 ? remainingDue : 0;

  const receiptData = useMemo<ReceiptPreviewData>(
    () => ({
      billNumber: bill.bill_number,
      createdAt: bill.created_at,
      customerName: detail.customerName || "Walk-in",
      customerPhone: detail.customerPhone || "",
      paymentMode: bill.payment_mode,
      status: bill.status,
      items: items.map((item) => ({
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        rowTotal: item.row_total,
        mrp: item.mrp,
      })),
      subtotal: bill.subtotal_amount,
      otherItemsAmount: bill.other_items_amount,
      discountAmount: bill.discount_amount,
      totalPayable: bill.total_payable_amount,
      receivedAmount: bill.received_amount_total,
      businessName,
      businessAddress,
      businessPhone,
      businessGstin,
      receiptFooter,
      logoUrl,
      showLogoOnBill,
    }),
    [
      bill,
      businessAddress,
      businessGstin,
      businessName,
      businessPhone,
      detail.customerName,
      detail.customerPhone,
      items,
      logoUrl,
      receiptFooter,
      showLogoOnBill,
    ],
  );

  useEffect(() => {
    setChrome({
      title: bill.bill_number?.trim() || "—",
      actions: (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReceiptOpen(true)}
          >
            <Printer />
            Receipt
          </Button>
          {canReturn ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReturnOpen(true)}
            >
              <RotateCcw />
              Return
            </Button>
          ) : null}
        </>
      ),
    });
    return () => clearChrome();
  }, [bill.bill_number, canReturn, setChrome, clearChrome]);

  const handleCompletePayment = () => {
    startCollect(async () => {
      const result = await completePaymentAction({
        billId: bill.id,
        accountId: defaultAccountId ?? accounts[0]?.id ?? null,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Collected ${formatCurrency(result.data.collectedAmount)}`,
      );
      router.refresh();
    });
  };

  const discountText = discountLabel(bill);

  return (
    <>
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="rounded-lg bg-card p-4 shadow-card sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-semibold">
                  {detail.customerName || "Walk-in"}
                </p>
                {detail.customerPhone ? (
                  <p className="mt-0.5 text-[13px] text-primary">
                    {detail.customerPhone}
                  </p>
                ) : null}
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {formatDateTime(bill.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-info-muted font-semibold text-info-accent">
                  {paymentModeLabel(bill.payment_mode)}
                </Badge>
                <StatusBadge
                  status={billStatusVariant(bill.status)}
                  label={billStatusLabel(bill.status)}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
            <div className="rounded-lg bg-card p-4 shadow-card sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-[13px] font-bold">Items</h2>
                <span className="rounded-md bg-primary-muted px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {items.length}
                </span>
              </div>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No line items</p>
              ) : (
                <div className="divide-y divide-border">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium">
                          {item.product_name}
                        </p>
                        <p className="text-[12px] text-muted-foreground">
                          {item.quantity} × {formatCurrency(item.unit_price)}
                          {item.returnedQty > 0
                            ? ` · Returned ${item.returnedQty}`
                            : null}
                        </p>
                      </div>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                        {formatCurrency(item.row_total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="min-w-0 self-start space-y-2">
              <div className="flex items-center justify-between gap-2 px-0.5">
                <h2 className="text-[13px] font-bold">Returns</h2>
                {returns.length > 0 ? (
                  <span className="text-[12px] font-semibold text-primary tabular-nums">
                    {formatCurrency(totalReturnedAmount)}
                  </span>
                ) : null}
              </div>
              {returns.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
                  No returns yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {returns.map((entry) => (
                    <ReturnHistoryCard key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="w-full shrink-0 self-start lg:sticky lg:top-20 lg:w-85">
          <div className="rounded-lg bg-card p-4 shadow-card sm:p-5">
            <h2 className="mb-3 text-[13px] font-bold">Payment</h2>
            <div className="space-y-2.5">
              <SummaryRow
                label="Subtotal"
                value={formatCurrency(bill.subtotal_amount)}
              />
              {bill.other_items_amount > 0 ? (
                <SummaryRow
                  label="Other Items"
                  value={formatCurrency(bill.other_items_amount)}
                />
              ) : null}
              {discountText && bill.discount_amount > 0 ? (
                <SummaryRow
                  label={discountText}
                  value={`- ${formatCurrency(bill.discount_amount)}`}
                  valueClassName="text-warning-icon"
                />
              ) : null}
              <SummaryRow
                label="Total Payable"
                value={formatCurrency(bill.total_payable_amount)}
                bold
              />
              {totalReturnedAmount > 0 ? (
                <SummaryRow
                  label="Returned Amount"
                  value={`- ${formatCurrency(totalReturnedAmount)}`}
                  valueClassName="text-primary"
                />
              ) : null}

              <div className="flex items-center justify-between gap-3 border-t border-border pt-2.5 text-[13px]">
                <span className="text-muted-foreground">Payment</span>
                <Badge className="bg-info-muted font-semibold text-info-accent">
                  {paymentModeLabel(bill.payment_mode)}
                </Badge>
              </div>
              {bill.payment_mode === "Mixed" ? (
                <>
                  <SummaryRow
                    label="  Cash"
                    value={formatCurrency(bill.cash_amount)}
                  />
                  <SummaryRow
                    label="  Online"
                    value={formatCurrency(bill.online_amount)}
                  />
                </>
              ) : null}
              <SummaryRow
                label="Received"
                value={formatCurrency(bill.received_amount_total)}
              />

              {changeGiven > 0 ? (
                <div className="rounded-md bg-success-muted px-3 py-2">
                  <p className="text-[11px] font-medium text-success-icon">
                    Change already returned to customer
                  </p>
                  <p className="text-[13px] font-semibold text-success-icon tabular-nums">
                    {formatCurrency(changeGiven)}
                  </p>
                </div>
              ) : dueAmount > 0 ? (
                <>
                  <SummaryRow
                    label="Due Amount"
                    value={formatCurrency(dueAmount)}
                    valueClassName="text-warning-icon"
                    bold
                  />
                  {canCompletePayment ? (
                    <Button
                      type="button"
                      className="w-full"
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
                          Collect Due Payment
                        </>
                      )}
                    </Button>
                  ) : null}
                </>
              ) : (
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="font-semibold text-success-icon">
                    Payment settled
                  </span>
                  <span className="text-muted-foreground">—</span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      <ReturnBillModal
        open={returnOpen}
        onOpenChange={setReturnOpen}
        detail={detail}
        accounts={accounts}
        defaultAccountId={defaultAccountId}
        onSuccess={() => router.refresh()}
      />

      <ReceiptDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        data={receiptData}
        includePaidAmountInWhatsApp={false}
      />
    </>
  );
}
