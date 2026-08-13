"use client";

import { MessageCircle, Printer } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/utils/currency";
import { formatDateTime } from "@/utils/date";
import { printReceiptDocument } from "@/utils/print-receipt-document";
import {
  readPrintSettings,
  type ReceiptPaperWidth,
} from "@/utils/print-settings";
import {
  shouldShowReceiptLogo,
  type ReceiptPreviewData,
} from "@/utils/receipt-preview-data";
import { getReceiptPrintLayout } from "@/utils/receipt-print-layout";
import { shareBillOnWhatsApp } from "@/utils/share-bill-whatsapp";

export type { ReceiptPreviewData };

export function ReceiptPreview({ data }: { data: ReceiptPreviewData }) {
  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidth>("80mm");

  useEffect(() => {
    setPaperWidth(readPrintSettings().paperWidth);
  }, []);

  const layout = getReceiptPrintLayout(paperWidth);
  const logoSrc = data.logoUrl?.trim() || "";
  const showLogo = shouldShowReceiptLogo(data);
  const businessTitle = data.businessName?.trim() || "POSTrack Receipt";

  return (
    <div
      className="mx-auto bg-white text-black"
      style={{
        width: `${layout.paperWidthMm}mm`,
        maxWidth: "100%",
        padding: `8px ${layout.sideMarginMm}mm`,
      }}
    >
      <div style={{ width: "100%", maxWidth: `${layout.printableWidthMm}mm` }}>
      <div className="mb-4 text-center">
        {showLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- receipt print/preview needs a plain img URL
          <img
            src={logoSrc}
            alt={businessTitle}
            className="mx-auto mb-2 max-h-16 w-auto max-w-[70%] object-contain"
          />
        ) : null}
        <h1 className="text-lg font-bold">{businessTitle}</h1>
        {data.billNumber ? <p className="text-sm">{data.billNumber}</p> : null}
        <p className="text-xs text-gray-600">
          {formatDateTime(data.createdAt)}
        </p>
      </div>

      <div className="mb-4 text-sm">
        <p>
          <span className="font-medium">Customer:</span> {data.customerName}
        </p>
        {data.customerPhone ? <p>Phone: {data.customerPhone}</p> : null}
        <p>Payment: {data.paymentMode}</p>
        {data.status ? <p>Status: {data.status}</p> : null}
      </div>

      <table className="mb-4 w-full text-sm">
        <thead>
          <tr className="border-b border-black/20">
            <th className="py-1 text-left font-medium">Item</th>
            <th className="py-1 font-medium">Qty</th>
            <th className="py-1 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, index) => (
            <tr
              key={`${item.productName}-${index}`}
              className="border-b border-dashed border-black/20"
            >
              <td className="py-1 pr-2">{item.productName}</td>
              <td className="py-1 text-center tabular-nums">{item.quantity}</td>
              <td className="py-1 text-right tabular-nums">
                {formatCurrency(item.rowTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatCurrency(data.subtotal)}</span>
        </div>
        {data.otherItemsAmount > 0 ? (
          <div className="flex justify-between">
            <span>Other items</span>
            <span className="tabular-nums">
              {formatCurrency(data.otherItemsAmount)}
            </span>
          </div>
        ) : null}
        {data.discountAmount > 0 ? (
          <div className="flex justify-between">
            <span>Discount</span>
            <span className="tabular-nums">
              -{formatCurrency(data.discountAmount)}
            </span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-black/20 pt-2 text-base font-bold">
          <span>Total</span>
          <span className="tabular-nums">
            {formatCurrency(data.totalPayable)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Received</span>
          <span className="tabular-nums">
            {formatCurrency(data.receivedAmount)}
          </span>
        </div>
      </div>

      {data.receiptFooter?.trim() ? (
        <p className="mt-4 text-center text-xs text-gray-600">
          {data.receiptFooter}
        </p>
      ) : null}
      </div>
    </div>
  );
}

type ReceiptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReceiptPreviewData | null;
};

export function ReceiptDialog({
  open,
  onOpenChange,
  data,
}: ReceiptDialogProps) {
  const [isPrinting, startPrint] = useTransition();

  const handlePrint = () => {
    if (!data) return;
    startPrint(async () => {
      try {
        await printReceiptDocument(data);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to print receipt",
        );
      }
    });
  };

  const handleWhatsApp = () => {
    if (!data) return;
    shareBillOnWhatsApp({
      businessName: data.businessName,
      billNumber: data.billNumber,
      createdAt: data.createdAt,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      items: data.items,
      otherItemsAmount: data.otherItemsAmount,
      totalPayable: data.totalPayable,
      receivedAmount: data.receivedAmount,
      paymentMode: data.paymentMode,
      status: data.status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border/60 px-5 py-4 pr-12">
          <DialogTitle>
            {data?.billNumber ? `Bill ${data.billNumber}` : "Receipt"}
          </DialogTitle>
        </DialogHeader>

        {data ? (
          <div className="px-5 py-4">
            <ReceiptPreview data={data} />
          </div>
        ) : null}

        <DialogFooter className="mx-0 mb-0 rounded-b-lg sm:justify-stretch">
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              disabled={!data || isPrinting}
              onClick={handlePrint}
            >
              <Printer />
              {isPrinting ? "Printing…" : "Print / Save PDF"}
            </Button>
            <Button type="button" variant="outline" onClick={handleWhatsApp}>
              <MessageCircle />
              WhatsApp
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
