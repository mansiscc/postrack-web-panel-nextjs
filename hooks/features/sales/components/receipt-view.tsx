"use client";

import { MessageCircle, Printer } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { BillItemRow, BillRow } from "@/repositories/bills.repository";
import { formatCurrency } from "@/utils/currency";
import { formatDateTime } from "@/utils/date";
import {
  paperWidthToMaxCss,
  readPrintSettings,
  type ReceiptPaperWidth,
} from "@/utils/print-settings";

type ReceiptViewProps = {
  bill: BillRow;
  items: BillItemRow[];
  customerName: string;
  customerPhone: string;
  businessName?: string | null;
  receiptFooter?: string | null;
};

export function ReceiptView({
  bill,
  items,
  customerName,
  customerPhone,
  businessName,
  receiptFooter,
}: ReceiptViewProps) {
  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidth>("80mm");

  useEffect(() => {
    document.title = `Receipt ${bill.bill_number ?? bill.id}`;
    setPaperWidth(readPrintSettings().paperWidth);
  }, [bill]);

  const shareOnWhatsApp = () => {
    const lines = [
      businessName?.trim() || "POSTrack Receipt",
      bill.bill_number ? `Bill: ${bill.bill_number}` : null,
      `Date: ${formatDateTime(bill.created_at)}`,
      `Customer: ${customerName}${customerPhone ? ` (${customerPhone})` : ""}`,
      "",
      ...items.map(
        (item) =>
          `${item.product_name} x${item.quantity} = ${formatCurrency(item.row_total)}`,
      ),
      "",
      `Total: ${formatCurrency(bill.total_payable_amount)}`,
      `Received: ${formatCurrency(bill.received_amount_total)}`,
      `Payment: ${bill.payment_mode}`,
      `Status: ${bill.status}`,
    ].filter(Boolean);

    const text = encodeURIComponent(lines.join("\n"));
    const digits = customerPhone.replace(/\D/g, "");
    const url = digits
      ? `https://wa.me/${digits}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="mx-auto bg-white p-6 text-black print:p-4"
      style={{ maxWidth: paperWidthToMaxCss(paperWidth) }}
    >
      <div className="mb-4 text-center">
        <h1 className="text-lg font-bold">
          {businessName?.trim() || "POSTrack Receipt"}
        </h1>
        <p className="text-sm">{bill.bill_number}</p>
        <p className="text-xs text-gray-600">{formatDateTime(bill.created_at)}</p>
      </div>

      <div className="mb-4 text-sm">
        <p>
          <span className="font-medium">Customer:</span> {customerName}
        </p>
        {customerPhone ? <p>Phone: {customerPhone}</p> : null}
        <p>Payment: {bill.payment_mode}</p>
        <p>Status: {bill.status}</p>
      </div>

      <table className="mb-4 w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-1 text-left">Item</th>
            <th className="py-1">Qty</th>
            <th className="py-1">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-dashed">
              <td className="py-1">{item.product_name}</td>
              <td className="py-1 text-center tabular-nums">{item.quantity}</td>
              <td className="py-1 text-right tabular-nums">
                {formatCurrency(item.row_total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCurrency(bill.subtotal_amount)}</span>
        </div>
        {bill.other_items_amount > 0 ? (
          <div className="flex justify-between">
            <span>Other items</span>
            <span>{formatCurrency(bill.other_items_amount)}</span>
          </div>
        ) : null}
        {bill.discount_amount > 0 ? (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-{formatCurrency(bill.discount_amount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <span>Total</span>
          <span>{formatCurrency(bill.total_payable_amount)}</span>
        </div>
        <div className="flex justify-between">
          <span>Received</span>
          <span>{formatCurrency(bill.received_amount_total)}</span>
        </div>
      </div>

      {receiptFooter?.trim() ? (
        <p className="mt-4 text-center text-xs text-gray-600">
          {receiptFooter}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-center gap-2 print:hidden">
        <Button type="button" onClick={() => window.print()}>
          <Printer />
          Print / Save PDF
        </Button>
        <Button type="button" variant="outline" onClick={shareOnWhatsApp}>
          <MessageCircle />
          WhatsApp
        </Button>
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white;
          }
          nav,
          aside,
          header {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
