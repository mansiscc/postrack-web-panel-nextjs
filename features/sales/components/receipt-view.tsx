"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import type { BillItemRow, BillRow } from "@/repositories/bills.repository";
import { formatCurrency } from "@/utils/currency";
import { formatDateTime } from "@/utils/date";

type ReceiptViewProps = {
  bill: BillRow;
  items: BillItemRow[];
  customerName: string;
  customerPhone: string;
};

export function ReceiptView({
  bill,
  items,
  customerName,
  customerPhone,
}: ReceiptViewProps) {
  useEffect(() => {
    document.title = `Receipt ${bill.bill_number ?? bill.id}`;
  }, [bill]);

  return (
    <div className="mx-auto max-w-md bg-white p-6 text-black print:p-4">
      <div className="mb-4 text-center">
        <h1 className="text-lg font-bold">POSTrack Receipt</h1>
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
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-dashed">
              <td className="py-1">{item.product_name}</td>
              <td className="py-1 text-right tabular-nums">{item.quantity}</td>
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

      <div className="mt-6 flex justify-center gap-2 print:hidden">
        <Button type="button" onClick={() => window.print()}>
          Print receipt
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
