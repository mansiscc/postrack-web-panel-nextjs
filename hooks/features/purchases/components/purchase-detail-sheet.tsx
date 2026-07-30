"use client";

import {
  Calendar,
  FileText,
  Loader2,
  Package,
  ReceiptText,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { getPurchaseDetailsAction } from "@/hooks/features/purchases/actions";
import type { PurchaseListItem } from "@/hooks/features/purchases/types";
import {
  ModalCard,
  ModalCardBody,
  ModalCardContent,
  ModalCardHeader,
  ModalCardTitle,
} from "@/components/ui/modal-card";
import type { StockInItemDetail } from "@/repositories/stock-in.repository";
import { formatCurrency, formatNumber } from "@/utils/currency";
import { formatDate, formatDateTime } from "@/utils/date";

type PurchaseDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: PurchaseListItem | null;
};

function SectionLabel({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <Icon className="size-3.5 text-primary" strokeWidth={2.25} />
      <h3 className="text-[13px] font-bold text-foreground">{title}</h3>
    </div>
  );
}

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

  const supplierName =
    meta?.supplierName || purchase?.supplierName || "Walk-in Purchase";
  const notesDisplay =
    meta?.notes?.trim() ||
    "No additional notes added for this stock-in.";

  return (
    <ModalCard open={open} onOpenChange={onOpenChange}>
      <ModalCardContent size="2xl">
        <ModalCardHeader>
          <ModalCardTitle>Stock-In Details</ModalCardTitle>
          {purchase?.createdAt ? (
            <p className="text-[12px] text-muted-foreground">
              {formatDateTime(purchase.createdAt)}
            </p>
          ) : null}
        </ModalCardHeader>

        {isPending && items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ModalCardBody className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
              <div className="space-y-4">
                <div className="overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-card">
                  <div className="space-y-3.5 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-2.5">
                        <p className="text-[17px] font-bold leading-snug tracking-tight">
                          {supplierName}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] font-medium">
                          {purchase?.invoiceNumber ? (
                            <span className="inline-flex items-center gap-1.5">
                              <ReceiptText
                                className="size-3.5 shrink-0 opacity-90"
                                strokeWidth={2.25}
                              />
                              <span className="font-semibold tracking-wide">
                                {purchase.invoiceNumber}
                              </span>
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar
                              className="size-3.5 shrink-0 opacity-90"
                              strokeWidth={2.25}
                            />
                            {purchase ? formatDate(purchase.date) : "—"}
                          </span>
                        </div>
                      </div>
                      <p className="shrink-0 text-[22px] font-bold tabular-nums tracking-tight">
                        {formatCurrency(purchase?.totalAmount)}
                      </p>
                    </div>

                    <div className="h-px bg-white/30" />

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <Package
                          className="size-3.5 shrink-0 opacity-90"
                          strokeWidth={2.25}
                        />
                        {purchase?.totalItems === 1
                          ? "1 item"
                          : `${formatNumber(purchase?.totalItems ?? 0)} items`}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <ReceiptText
                          className="size-3.5 shrink-0 opacity-90"
                          strokeWidth={2.25}
                        />
                        {purchase?.createdByName
                          ? `Added by: ${purchase.createdByName}`
                          : "Stock-In Summary"}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <SectionLabel icon={FileText} title="Additional Notes" />
                  <div className="rounded-lg bg-card p-4 shadow-card">
                    <p className="text-[13px] leading-relaxed text-foreground">
                      {notesDisplay}
                    </p>
                    {meta?.accountName ? (
                      <p className="mt-3 border-t border-border/60 pt-3 text-[12px] text-muted-foreground">
                        Payment account:{" "}
                        <span className="font-medium text-foreground">
                          {meta.accountName}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div>
                <SectionLabel icon={Package} title="Items" />
                <div className="rounded-lg bg-card p-2 shadow-card sm:p-3">
                  {items.length === 0 ? (
                    <p className="px-2 py-6 text-[13px] text-muted-foreground">
                      No items found for this stock-in.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-start justify-between gap-3 px-2 py-3"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="truncate text-[13px] font-semibold text-foreground">
                              {item.product_name}
                            </p>
                            {item.batch_name ? (
                              <span className="inline-flex rounded-md bg-warning-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                                {item.batch_name}
                              </span>
                            ) : null}
                            <p className="text-[12px] tabular-nums text-muted-foreground">
                              {formatCurrency(item.purchase_price)} ×{" "}
                              {formatNumber(item.quantity)}
                            </p>
                          </div>
                          <p className="shrink-0 text-[13px] font-semibold tabular-nums text-primary">
                            {formatCurrency(item.row_total)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </ModalCardBody>
        )}
      </ModalCardContent>
    </ModalCard>
  );
}
