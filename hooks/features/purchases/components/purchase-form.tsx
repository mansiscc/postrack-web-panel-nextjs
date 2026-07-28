"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { createPurchaseAction } from "@/hooks/features/purchases/actions";
import type { PurchaseLineItemInput } from "@/hooks/features/purchases/schema";
import { FormField } from "@/components/forms/form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AccountRow } from "@/repositories/accounts.repository";
import type { ProductListRow } from "@/repositories/products.repository";
import type { SupplierListRow } from "@/repositories/suppliers.repository";
import { formatCurrency } from "@/utils/currency";

type PurchaseFormProps = {
  suppliers: SupplierListRow[];
  products: ProductListRow[];
  accounts: AccountRow[];
  defaultAccountId: string | null;
};

const emptyLine = (): PurchaseLineItemInput => ({
  productId: "",
  quantity: 1,
  purchasePrice: 0,
  sellingPrice: null,
  mrp: null,
  batchName: "",
  rowTotal: 0,
});

export function PurchaseForm({
  suppliers,
  products,
  accounts,
  defaultAccountId,
}: PurchaseFormProps) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [supplierId, setSupplierId] = useState<string>("none");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [accountId, setAccountId] = useState(defaultAccountId ?? "");
  const [lines, setLines] = useState<PurchaseLineItemInput[]>([emptyLine()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const grandTotal = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.rowTotal || 0), 0),
    [lines],
  );

  const updateLine = (
    index: number,
    patch: Partial<PurchaseLineItemInput>,
  ) => {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        const qty = Number(next.quantity || 0);
        const price = Number(next.purchasePrice || 0);
        if ("quantity" in patch || "purchasePrice" in patch) {
          next.rowTotal = Number((qty * price).toFixed(2));
        }
        return next;
      }),
    );
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = productMap.get(productId);
    const qty = Number(lines[index]?.quantity ?? 1);
    const price = Number(product?.purchase_price ?? 0);
    updateLine(index, {
      productId,
      purchasePrice: product?.purchase_price ?? 0,
      sellingPrice: product?.selling_price ?? null,
      mrp: product?.mrp ?? null,
      rowTotal: Number((qty * price).toFixed(2)),
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await createPurchaseAction({
        date,
        supplierId: supplierId === "none" ? null : supplierId,
        invoiceNumber: invoiceNumber || null,
        notes: notes || null,
        accountId,
        items: lines.filter((line) => line.productId),
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Purchase saved");
      router.push("/purchases");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="New purchase"
        actions={
          <>
            <Button type="button" variant="ghost" asChild>
              <Link href="/purchases">Cancel</Link>
            </Button>
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleSubmit()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving…
                </>
              ) : (
                "Save purchase"
              )}
            </Button>
          </>
        }
      />

      <Card className="mb-6">
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
          <FormField label="Date" htmlFor="date" required>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </FormField>
          <FormField label="Supplier">
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Walk-in" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Walk-in</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.supplier_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Invoice number" htmlFor="invoiceNumber">
            <Input
              id="invoiceNumber"
              value={invoiceNumber}
              onChange={(event) => setInvoiceNumber(event.target.value)}
            />
          </FormField>
          <FormField label="Payment account" required>
            <Select value={accountId} onValueChange={setAccountId}>
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
          </FormField>
          <FormField label="Notes" htmlFor="notes" className="md:col-span-2 xl:col-span-4">
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>
        </CardContent>
      </Card>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium">Line items</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
        >
          <Plus />
          Add row
        </Button>
      </div>

      <div className="space-y-3">
        {lines.map((line, index) => (
          <Card key={index}>
            <CardContent className="grid gap-3 pt-6 md:grid-cols-6 xl:grid-cols-8">
              <FormField label="Product" className="md:col-span-2">
                <Select
                  value={line.productId || "none"}
                  onValueChange={(value) =>
                    value !== "none" && handleProductChange(index, value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select product</SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Batch">
                <Input
                  value={line.batchName ?? ""}
                  onChange={(event) =>
                    updateLine(index, { batchName: event.target.value })
                  }
                />
              </FormField>
              <FormField label="Purchase ₹">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.purchasePrice}
                  onChange={(event) =>
                    updateLine(index, { purchasePrice: event.target.value })
                  }
                />
              </FormField>
              <FormField label="Selling ₹">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.sellingPrice ?? ""}
                  onChange={(event) =>
                    updateLine(index, { sellingPrice: event.target.value })
                  }
                />
              </FormField>
              <FormField label="MRP">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.mrp ?? ""}
                  onChange={(event) =>
                    updateLine(index, { mrp: event.target.value })
                  }
                />
              </FormField>
              <FormField label="Qty">
                <Input
                  type="number"
                  min={0}
                  step="1"
                  value={line.quantity}
                  onChange={(event) =>
                    updateLine(index, { quantity: event.target.value })
                  }
                />
              </FormField>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="mb-2 text-sm font-medium">Total</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCurrency(Number(line.rowTotal || 0))}
                  </p>
                </div>
                {lines.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setLines((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="sticky bottom-0 mt-6 flex items-center justify-between border-t bg-background/95 py-4 backdrop-blur">
        <p className="text-sm text-muted-foreground">
          {lines.filter((line) => line.productId).length} line item(s)
        </p>
        <p className="text-lg font-semibold tabular-nums">
          Grand total: {formatCurrency(grandTotal)}
        </p>
      </div>
    </>
  );
}
