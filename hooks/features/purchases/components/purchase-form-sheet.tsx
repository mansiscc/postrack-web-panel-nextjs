"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createPurchaseAction,
  getPurchaseProductBatchesAction,
} from "@/hooks/features/purchases/actions";
import type { PurchaseLineItemInput } from "@/hooks/features/purchases/schema";
import { FormField } from "@/components/forms/form-field";
import { SearchSuggestField } from "@/components/forms/search-suggest-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { onDecimalChange, onIntegerChange } from "@/lib/validation/rhf";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ModalCard,
  ModalCardBody,
  ModalCardContent,
  ModalCardFooter,
  ModalCardHeader,
  ModalCardTitle,
} from "@/components/ui/modal-card";
import type { AccountRow } from "@/repositories/accounts.repository";
import type {
  ProductBatchRow,
  ProductListRow,
} from "@/repositories/products.repository";
import type { SupplierListRow } from "@/repositories/suppliers.repository";
import { formatCurrency, formatNumber } from "@/utils/currency";

type PurchaseFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: SupplierListRow[];
  products: ProductListRow[];
  accounts: AccountRow[];
  defaultAccountId: string | null;
};

type LineState = PurchaseLineItemInput & {
  /** Typed search text shown in the product field (billing customer pattern). */
  productQuery: string;
  /** Selected existing batch id, or "new" for create-new-batch. */
  selectedBatchKey: string;
};

const NEW_BATCH_KEY = "new";

const emptyLine = (): LineState => ({
  productId: "",
  productQuery: "",
  quantity: 1,
  purchasePrice: 0,
  sellingPrice: null,
  mrp: null,
  batchName: "",
  rowTotal: 0,
  selectedBatchKey: NEW_BATCH_KEY,
});

function suggestedBatchName(batches: ProductBatchRow[]) {
  const nextSeq = (batches.reduce((max, batch) => Math.max(max, batch.batch_seq), 0) || 0) + 1;
  return `Batch ${nextSeq}`;
}

function batchLabel(batch: ProductBatchRow) {
  return batch.name?.trim() || `Batch ${batch.batch_seq}`;
}

function batchDescription(batch: ProductBatchRow) {
  const parts = [
    `Buy ${formatCurrency(batch.purchase_price)}`,
    `Sell ${formatCurrency(batch.selling_price)}`,
  ];
  if (batch.mrp != null) parts.push(`MRP ${formatCurrency(batch.mrp)}`);
  parts.push(`Stock ${formatNumber(batch.quantity_remaining)}`);
  return parts.join(" · ");
}

export function PurchaseFormSheet({
  open,
  onOpenChange,
  suppliers,
  products,
  accounts,
  defaultAccountId,
}: PurchaseFormSheetProps) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [supplierId, setSupplierId] = useState("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [accountId, setAccountId] = useState(defaultAccountId ?? "");
  const [lines, setLines] = useState<LineState[]>([emptyLine()]);
  const [batchesByLine, setBatchesByLine] = useState<Record<number, ProductBatchRow[]>>(
    {},
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, startBatchLoad] = useTransition();

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const supplierOptions = useMemo(
    () =>
      suppliers.map((supplier) => ({
        id: supplier.id,
        title: supplier.supplier_name,
        subtitle: supplier.phone ?? undefined,
      })),
    [suppliers],
  );

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        id: product.id,
        title: product.name,
        subtitle: product.barcode ?? undefined,
      })),
    [products],
  );

  const filledLines = useMemo(
    () => lines.filter((line) => line.productId),
    [lines],
  );

  const grandTotal = useMemo(
    () => filledLines.reduce((sum, line) => sum + Number(line.rowTotal || 0), 0),
    [filledLines],
  );

  useEffect(() => {
    if (!open) return;
    setDate(new Date().toISOString().slice(0, 10));
    setSupplierId("");
    setSupplierQuery("");
    setInvoiceNumber("");
    setNotes("");
    setAccountId(defaultAccountId ?? accounts[0]?.id ?? "");
    setLines([emptyLine()]);
    setBatchesByLine({});
    setIsSubmitting(false);
  }, [open, defaultAccountId, accounts]);

  const updateLine = (index: number, patch: Partial<LineState>) => {
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

  const loadBatchesForLine = (index: number, productId: string) => {
    startBatchLoad(async () => {
      try {
        const batches = await getPurchaseProductBatchesAction(productId);
        const sorted = [...batches].sort((a, b) => b.batch_seq - a.batch_seq);
        setBatchesByLine((prev) => ({ ...prev, [index]: sorted }));

        setLines((prev) =>
          prev.map((line, i) => {
            if (i !== index) return line;
            const qty = Number(line.quantity || 1);
            const latest = sorted[0];
            if (latest) {
              return {
                ...line,
                productId,
                selectedBatchKey: latest.id,
                batchName: batchLabel(latest),
                purchasePrice: latest.purchase_price,
                sellingPrice: latest.selling_price,
                mrp: latest.mrp,
                rowTotal: Number((qty * latest.purchase_price).toFixed(2)),
              };
            }
            const product = productMap.get(productId);
            const price = Number(product?.purchase_price ?? 0);
            return {
              ...line,
              productId,
              selectedBatchKey: NEW_BATCH_KEY,
              batchName: "Batch 1",
              purchasePrice: product?.purchase_price ?? 0,
              sellingPrice: product?.selling_price ?? null,
              mrp: product?.mrp ?? null,
              rowTotal: Number((qty * price).toFixed(2)),
            };
          }),
        );
      } catch {
        toast.error("Failed to load batches");
        setBatchesByLine((prev) => ({ ...prev, [index]: [] }));
      }
    });
  };

  const handleProductQueryChange = (index: number, query: string) => {
    const selected = productMap.get(lines[index]?.productId ?? "");
    const stillMatches = selected?.name === query;
    if (!stillMatches && lines[index]?.productId) {
      updateLine(index, {
        productId: "",
        productQuery: query,
        selectedBatchKey: NEW_BATCH_KEY,
        batchName: "",
        purchasePrice: 0,
        sellingPrice: null,
        mrp: null,
        rowTotal: 0,
      });
      setBatchesByLine((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      return;
    }
    updateLine(index, { productQuery: query });
  };

  const handleProductSelect = (index: number, productId: string, title: string) => {
    updateLine(index, {
      productId,
      productQuery: title,
      selectedBatchKey: NEW_BATCH_KEY,
      batchName: "",
    });
    loadBatchesForLine(index, productId);
  };

  const handleBatchChange = (index: number, batchKey: string) => {
    const batches = batchesByLine[index] ?? [];
    if (batchKey === NEW_BATCH_KEY) {
      const product = productMap.get(lines[index]?.productId ?? "");
      const price = Number(product?.purchase_price ?? lines[index]?.purchasePrice ?? 0);
      const qty = Number(lines[index]?.quantity ?? 1);
      updateLine(index, {
        selectedBatchKey: NEW_BATCH_KEY,
        batchName: suggestedBatchName(batches),
        purchasePrice: product?.purchase_price ?? price,
        sellingPrice: product?.selling_price ?? null,
        mrp: product?.mrp ?? null,
        rowTotal: Number((qty * (product?.purchase_price ?? price)).toFixed(2)),
      });
      return;
    }

    const batch = batches.find((row) => row.id === batchKey);
    if (!batch) return;
    const qty = Number(lines[index]?.quantity ?? 1);
    updateLine(index, {
      selectedBatchKey: batch.id,
      batchName: batchLabel(batch),
      purchasePrice: batch.purchase_price,
      sellingPrice: batch.selling_price,
      mrp: batch.mrp,
      rowTotal: Number((qty * batch.purchase_price).toFixed(2)),
    });
  };

  const handleSubmit = async () => {
    if (!accountId) {
      toast.error("Please select a payment account");
      return;
    }
    if (filledLines.length === 0) {
      toast.error("Add at least one product");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createPurchaseAction({
        date,
        supplierId: supplierId || null,
        invoiceNumber: invoiceNumber || null,
        notes: notes || null,
        accountId,
        items: filledLines.map(
          ({ selectedBatchKey: _key, productQuery: _query, ...item }) => item,
        ),
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Purchase entry saved successfully.");
      onOpenChange(false);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalCard open={open} onOpenChange={onOpenChange}>
      <ModalCardContent size="2xl">
        <ModalCardHeader>
          <ModalCardTitle>Stock-In</ModalCardTitle>
        </ModalCardHeader>

        <ModalCardBody className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="Supplier (optional)">
              <SearchSuggestField
                value={supplierQuery}
                selectedId={supplierId || null}
                options={supplierOptions}
                placeholder="Search supplier name or phone"
                onValueChange={(query) => {
                  setSupplierQuery(query);
                  const selected = suppliers.find((row) => row.id === supplierId);
                  if (selected && selected.supplier_name !== query) {
                    setSupplierId("");
                  }
                }}
                onSelect={(option) => {
                  setSupplierId(option.id);
                  setSupplierQuery(option.title);
                }}
              />
            </FormField>

            <FormField label="Payment Account" required>
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

            <FormField label="Date" htmlFor="purchase-date" required>
              <Input
                id="purchase-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </FormField>

            <FormField label="Invoice No." htmlFor="invoiceNumber">
              <Input
                id="invoiceNumber"
                placeholder="INV-0001"
                value={invoiceNumber}
                onChange={(event) => setInvoiceNumber(event.target.value)}
              />
            </FormField>

            <FormField
              label="Notes (optional)"
              htmlFor="notes"
              className="sm:col-span-2 lg:col-span-4"
            >
              <Textarea
                id="notes"
                rows={2}
                placeholder="Add any additional remarks here..."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </FormField>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold text-foreground">
                Product Details
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
              >
                <Plus />
                Add Row
              </Button>
            </div>

            <div className="space-y-2.5">
              {lines.map((line, index) => {
                const batches = batchesByLine[index] ?? [];
                const latestBatchId = batches[0]?.id;

                return (
                  <div
                    key={index}
                    className="rounded-lg border border-border/60 bg-card p-3 shadow-card-sm"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="grid min-w-0 flex-1 gap-2.5 sm:grid-cols-2">
                        <FormField label="Product">
                          <SearchSuggestField
                            value={line.productQuery}
                            selectedId={line.productId || null}
                            options={productOptions}
                            placeholder="Search product or barcode"
                            onValueChange={(query) =>
                              handleProductQueryChange(index, query)
                            }
                            onSelect={(option) =>
                              handleProductSelect(
                                index,
                                option.id,
                                option.title,
                              )
                            }
                          />
                        </FormField>

                        <FormField label="Batch">
                          <Select
                            value={
                              line.productId
                                ? line.selectedBatchKey || NEW_BATCH_KEY
                                : ""
                            }
                            onValueChange={(value) =>
                              handleBatchChange(index, value)
                            }
                            disabled={!line.productId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select batch" />
                            </SelectTrigger>
                            <SelectContent>
                              {batches.map((batch) => (
                                <SelectItem key={batch.id} value={batch.id}>
                                  {batchLabel(batch)}
                                  {batch.id === latestBatchId ? " · Latest" : ""}
                                  {" — "}
                                  {batchDescription(batch)}
                                </SelectItem>
                              ))}
                              <SelectItem value={NEW_BATCH_KEY}>
                                New batch — create with entered prices
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormField>
                      </div>

                      {lines.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          onClick={() => {
                            setLines((prev) =>
                              prev.filter((_, i) => i !== index),
                            );
                            setBatchesByLine((prev) => {
                              const next: Record<number, ProductBatchRow[]> = {};
                              Object.entries(prev).forEach(([key, value]) => {
                                const keyIndex = Number(key);
                                if (keyIndex < index) next[keyIndex] = value;
                                if (keyIndex > index) next[keyIndex - 1] = value;
                              });
                              return next;
                            });
                          }}
                        >
                          <Trash2 />
                        </Button>
                      ) : null}
                    </div>

                    {line.productId ? (
                      <p className="mb-3 text-[12px] text-muted-foreground">
                        {line.selectedBatchKey === NEW_BATCH_KEY
                          ? "Will create a new batch"
                          : `Will add to ${line.batchName || "selected batch"}`}
                      </p>
                    ) : null}

                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
                      <FormField label="Batch name">
                        <Input
                          placeholder="Batch 1"
                          value={line.batchName ?? ""}
                          onChange={(event) => {
                            updateLine(index, {
                              batchName: event.target.value,
                              selectedBatchKey: NEW_BATCH_KEY,
                            });
                          }}
                        />
                      </FormField>
                      <FormField label="Purchase price">
                        <Input
                          inputMode="decimal"
                          placeholder="0.00"
                          value={line.purchasePrice}
                          onChange={(event) =>
                            onDecimalChange(event.target.value, (value) =>
                              updateLine(index, {
                                purchasePrice: value,
                                selectedBatchKey: NEW_BATCH_KEY,
                              }),
                            )
                          }
                        />
                      </FormField>
                      <FormField label="Selling price">
                        <Input
                          inputMode="decimal"
                          placeholder="0.00"
                          value={line.sellingPrice ?? ""}
                          onChange={(event) =>
                            onDecimalChange(event.target.value, (value) =>
                              updateLine(index, {
                                sellingPrice: value,
                                selectedBatchKey: NEW_BATCH_KEY,
                              }),
                            )
                          }
                        />
                      </FormField>
                      <FormField label="MRP">
                        <Input
                          inputMode="decimal"
                          placeholder="0.00"
                          value={line.mrp ?? ""}
                          onChange={(event) =>
                            onDecimalChange(event.target.value, (value) =>
                              updateLine(index, {
                                mrp: value,
                                selectedBatchKey: NEW_BATCH_KEY,
                              }),
                            )
                          }
                        />
                      </FormField>
                      <FormField label="Quantity">
                        <Input
                          inputMode="numeric"
                          placeholder="0"
                          value={line.quantity}
                          onChange={(event) =>
                            onIntegerChange(event.target.value, (value) =>
                              updateLine(index, { quantity: value }),
                            )
                          }
                        />
                      </FormField>
                    </div>

                    <div className="mt-3 flex justify-end border-t border-border/60 pt-2">
                      <p className="text-[13px] font-semibold text-primary tabular-nums">
                        Row Total: {formatCurrency(Number(line.rowTotal || 0))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ModalCardBody>

        <ModalCardFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Grand Total
            </p>
            <div className="flex items-baseline gap-2.5">
              <p className="text-xl font-bold tabular-nums text-foreground">
                {formatCurrency(grandTotal)}
              </p>
              <p className="text-[13px] text-muted-foreground">
                · {filledLines.length} Items
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
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
                "Save Stock-In"
              )}
            </Button>
          </div>
        </ModalCardFooter>
      </ModalCardContent>
    </ModalCard>
  );
}
