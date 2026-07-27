"use client";

import {
  Loader2,
  Minus,
  Plus,
  Printer,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import {
  getProductBatchesAction,
  saveBillAction,
} from "@/hooks/features/billing/actions";
import { useBillingCart } from "@/hooks/features/billing/hooks/use-billing-cart";
import type { CartItem } from "@/hooks/features/billing/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AccountRow } from "@/repositories/accounts.repository";
import type { CustomerRow } from "@/repositories/customers.repository";
import { calculateBillingTotals } from "@/utils/billing-calculator";
import { formatCurrency } from "@/utils/currency";
import { cn } from "@/lib/utils";
import { readPrintSettings } from "@/utils/print-settings";

type BillingProduct = {
  id: string;
  name: string;
  barcode: string | null;
  selling_price: number | null;
  mrp: number | null;
  stock_quantity: number;
};

type BillingWorkspaceProps = {
  companyId: string;
  products: BillingProduct[];
  accounts: AccountRow[];
  customers: CustomerRow[];
  defaultAccountId: string | null;
};

type BatchOption = {
  id: string;
  name: string;
  selling_price: number | null;
  quantity_remaining: number;
};

type SavedBillInfo = {
  id: string;
  billNumber: string | null;
};

export function BillingWorkspace({
  companyId,
  products,
  accounts,
  customers,
  defaultAccountId,
}: BillingWorkspaceProps) {
  const {
    cart,
    addItem,
    updateItemQty,
    removeItem,
    clearCart,
    patchCart,
  } = useBillingCart(companyId, defaultAccountId ?? accounts[0]?.id ?? "");

  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualQty, setManualQty] = useState("1");
  const [savedBill, setSavedBill] = useState<SavedBillInfo | null>(null);
  const [pendingProduct, setPendingProduct] = useState<BillingProduct | null>(
    null,
  );
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [isSaving, startSave] = useTransition();
  const [isLoadingBatches, startBatchLoad] = useTransition();

  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase();
    return products.filter(
      (product) =>
        !term ||
        product.name.toLowerCase().includes(term) ||
        (product.barcode?.toLowerCase().includes(term) ?? false),
    );
  }, [products, search]);

  const totals = useMemo(
    () =>
      calculateBillingTotals({
        items: cart.items.map((item) => ({
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        })),
        otherItemsAmount: cart.otherItemsAmount,
        discountType: cart.discountType,
        discountValue: cart.discountValue,
        receivedAmount: cart.receivedAmount,
      }),
    [cart],
  );

  const canSave =
    cart.items.length > 0 || cart.otherItemsAmount > 0;

  const addProductToCart = useCallback(
    (product: BillingProduct, batch?: BatchOption) => {
      const unitPrice = batch?.selling_price ?? product.selling_price ?? 0;
      addItem({
        productId: product.id,
        productName: product.name,
        barcode: product.barcode,
        unitPrice,
        quantity: 1,
        batchId: batch?.id ?? null,
        batchName: batch?.name ?? null,
        maxQuantity: batch?.quantity_remaining ?? product.stock_quantity,
      });
    },
    [addItem],
  );

  const handleProductClick = useCallback(
    (product: BillingProduct) => {
      startBatchLoad(async () => {
        const result = await getProductBatchesAction(product.id);
        if (result.length > 1) {
          setPendingProduct(product);
          setBatches(result);
          setSelectedBatchId(result[0]?.id ?? "");
          setBatchDialogOpen(true);
          return;
        }
        if (result.length === 1) {
          addProductToCart(product, result[0]);
          return;
        }
        addProductToCart(product);
      });
    },
    [addProductToCart],
  );

  const handleBarcodeOrSearchEnter = () => {
    const term = search.trim();
    if (!term) return;

    const exactBarcode = products.find(
      (product) =>
        product.barcode?.toLowerCase() === term.toLowerCase(),
    );
    if (exactBarcode) {
      handleProductClick(exactBarcode);
      setSearch("");
      return;
    }

    if (filteredProducts.length === 1) {
      handleProductClick(filteredProducts[0]!);
      setSearch("");
      return;
    }

    if (filteredProducts.length === 0) {
      toast.error(`Product not found for barcode: ${term}`);
    }
  };

  const handleAddManual = () => {
    const name = manualName.trim();
    const price = Number(manualPrice || 0);
    const quantity = Math.max(1, Math.floor(Number(manualQty || 1)));

    if (!name) {
      toast.error("Manual item name is required");
      return;
    }
    if (price <= 0) {
      toast.error("Manual item price must be greater than 0");
      return;
    }

    addItem({
      productId: crypto.randomUUID(),
      productName: name,
      unitPrice: price,
      quantity,
      isManual: true,
    });
    setManualDialogOpen(false);
    setManualName("");
    setManualPrice("");
    setManualQty("1");
  };

  const handleReceiveRemaining = () => {
    if (totals.remainingAmount <= 0) return;
    patchCart({
      receivedAmount: Number(
        (cart.receivedAmount + totals.remainingAmount).toFixed(2),
      ),
    });
  };

  const handleWaiveRemaining = () => {
    if (totals.remainingAmount <= 0) return;
    const nextDiscount = Number(
      (totals.discountAmount + totals.remainingAmount).toFixed(2),
    );
    patchCart({
      discountType: "AMOUNT",
      discountValue: nextDiscount,
    });
  };

  const handleSave = () => {
    if (!canSave) {
      toast.error("Add cart items or an other-items amount");
      return;
    }
    if (cart.receivedAmount > 0 && !cart.selectedAccountId) {
      toast.error("Select a payment account");
      return;
    }

    startSave(async () => {
      const result = await saveBillAction({
        items: cart.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          barcode: item.barcode,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          batchId: item.batchId,
          isManual: item.isManual,
        })),
        customerId: cart.customerId,
        customerName: cart.customerName,
        customerPhone: cart.customerPhone,
        otherItemsAmount: cart.otherItemsAmount,
        discountType: cart.discountType,
        discountValue: cart.discountValue,
        paymentMode: cart.paymentMode,
        mixedCashAmount: cart.mixedCashAmount,
        mixedUpiAmount: cart.mixedUpiAmount,
        receivedAmount: cart.receivedAmount,
        accountId: cart.selectedAccountId,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const billInfo = {
        id: result.data.id,
        billNumber: result.data.billNumber,
      };
      clearCart();

      const { openReceiptAfterSave } = readPrintSettings();
      if (openReceiptAfterSave) {
        window.open(`/sales/${billInfo.id}/receipt`, "_blank", "noopener,noreferrer");
        toast.success(
          `Bill saved (${billInfo.billNumber ?? billInfo.id})`,
        );
        return;
      }

      setSavedBill(billInfo);
    });
  };

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" || tag === "textarea" || target?.isContentEditable;

      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        handleSaveRef.current();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col xl:flex-row">
        {/* Catalog */}
        <section className="flex min-h-0 w-full flex-col border-b border-border bg-card xl:w-70 xl:shrink-0 xl:border-r xl:border-b-0">
          <div className="shrink-0 space-y-2 border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleBarcodeOrSearchEnter();
                  }
                }}
                placeholder="Search or scan barcode…"
                className="h-10 pl-9"
                autoFocus
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setManualDialogOpen(true)}
            >
              Add manual item
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {filteredProducts.length === 0 ? (
              <p className="px-2 py-8 text-center text-[13px] text-muted-foreground">
                Type to search or scan barcode
              </p>
            ) : (
              <div className="space-y-1">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleProductClick(product)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">
                        {product.name}
                      </p>
                      <p
                        className={cn(
                          "text-[11px] tabular-nums",
                          product.stock_quantity <= 0
                            ? "text-destructive"
                            : product.stock_quantity <= 5
                              ? "text-warning"
                              : "text-muted-foreground",
                        )}
                      >
                        Stock {product.stock_quantity}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                      {formatCurrency(product.selling_price)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Cart */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-border bg-card xl:border-r xl:border-b-0">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
            <h2 className="text-[13px] font-bold tracking-tight">
              Cart{" "}
              <span className="font-medium text-muted-foreground">
                ({cart.items.length})
              </span>
            </h2>
            {cart.items.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearCart}>
                Clear all
              </Button>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {cart.items.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-muted-foreground">
                Add catalog or manual items to start a bill.
              </p>
            ) : (
              <div className="space-y-2">
                {cart.items.map((item) => (
                  <CartRow
                    key={item.id}
                    item={item}
                    onQtyChange={updateItemQty}
                    onRemove={removeItem}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center justify-between border-t border-border bg-muted/40 px-4 py-3">
            <span className="text-[13px] font-medium text-muted-foreground">
              Subtotal
            </span>
            <span className="text-base font-bold tabular-nums">
              {formatCurrency(totals.subtotal)}
            </span>
          </div>
        </section>

        {/* Payment */}
        <section className="flex min-h-0 w-full flex-col overflow-y-auto bg-card xl:w-90 xl:shrink-0">
          <div className="space-y-3.5 border-b border-border p-4">
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select
                value={cart.customerId ?? "walkin"}
                onValueChange={(value) => {
                  if (value === "walkin") {
                    patchCart({
                      customerId: null,
                      customerName: "",
                      customerPhone: "",
                    });
                    return;
                  }
                  const customer = customers.find((row) => row.id === value);
                  patchCart({
                    customerId: value,
                    customerName: customer?.name ?? "",
                    customerPhone: customer?.phone ?? "",
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Walk-in" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walkin">Walk-in</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} · {customer.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!cart.customerId ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    placeholder="Name"
                    value={cart.customerName}
                    onChange={(event) =>
                      patchCart({ customerName: event.target.value })
                    }
                  />
                  <Input
                    placeholder="Phone"
                    value={cart.customerPhone}
                    onChange={(event) =>
                      patchCart({ customerPhone: event.target.value })
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-3.5 border-b border-border p-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Other items ₹</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={cart.otherItemsAmount}
                  onChange={(event) =>
                    patchCart({
                      otherItemsAmount: Number(event.target.value || 0),
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Discount</Label>
                <div className="flex gap-2">
                  <Select
                    value={cart.discountType ?? "none"}
                    onValueChange={(value) =>
                      patchCart({
                        discountType:
                          value === "none"
                            ? null
                            : (value as "AMOUNT" | "PERCENT"),
                      })
                    }
                  >
                    <SelectTrigger className="w-20 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="AMOUNT">₹</SelectItem>
                      <SelectItem value="PERCENT">%</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    value={cart.discountValue}
                    onChange={(event) =>
                      patchCart({
                        discountValue: Number(event.target.value || 0),
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3.5 border-b border-border p-4">
            <div className="space-y-1.5">
              <Label>Payment mode</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["Cash", "UPI", "Card", "Mixed"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => patchCart({ paymentMode: mode })}
                    className={cn(
                      "rounded-lg border border-border px-1 py-2 text-center text-[12px] font-medium transition-colors",
                      cart.paymentMode === mode
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-card hover:bg-muted/50",
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {cart.paymentMode === "Mixed" ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Cash ₹</Label>
                  <Input
                    type="number"
                    min={0}
                    value={cart.mixedCashAmount}
                    onChange={(event) =>
                      patchCart({
                        mixedCashAmount: Number(event.target.value || 0),
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>UPI ₹</Label>
                  <Input
                    type="number"
                    min={0}
                    value={cart.mixedUpiAmount}
                    onChange={(event) =>
                      patchCart({
                        mixedUpiAmount: Number(event.target.value || 0),
                      })
                    }
                  />
                </div>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label>Received ₹</Label>
              <Input
                type="number"
                min={0}
                value={cart.receivedAmount}
                onChange={(event) =>
                  patchCart({ receivedAmount: Number(event.target.value || 0) })
                }
              />
            </div>

            {totals.remainingAmount > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReceiveRemaining}
                >
                  Receive {formatCurrency(totals.remainingAmount)}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleWaiveRemaining}
                >
                  Give {formatCurrency(totals.remainingAmount)} discount
                </Button>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label>
                Account
                {cart.receivedAmount > 0 ? "" : " (optional if unpaid)"}
              </Label>
              <Select
                value={cart.selectedAccountId || undefined}
                onValueChange={(value) =>
                  patchCart({ selectedAccountId: value })
                }
              >
                <SelectTrigger className="w-full">
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
          </div>

          <div className="mt-auto space-y-3 p-4">
            <div className="space-y-1.5 rounded-lg bg-muted/40 p-3 text-[13px]">
              <div className="flex justify-between">
                <span className="font-medium">Total payable</span>
                <span className="font-bold tabular-nums">
                  {formatCurrency(totals.totalPayable)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Change</span>
                <span className="tabular-nums">
                  {formatCurrency(totals.changeAmount)}
                </span>
              </div>
              {totals.remainingAmount > 0 ? (
                <div className="flex justify-between text-warning">
                  <span>Remaining</span>
                  <span className="tabular-nums">
                    {formatCurrency(totals.remainingAmount)}
                  </span>
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              className="h-11 w-full"
              disabled={isSaving || !canSave}
              onClick={handleSave}
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving…
                </>
              ) : (
                "Save bill"
              )}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Ctrl+Enter save · / focus search · Enter adds barcode
            </p>
          </div>
        </section>
      </div>

      {/* Batch picker */}
      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="sm:max-w-140">
          <DialogHeader>
            <DialogTitle>Select batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {batches.map((batch) => (
              <button
                key={batch.id}
                type="button"
                onClick={() => setSelectedBatchId(batch.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left",
                  selectedBatchId === batch.id && "border-primary bg-muted",
                )}
              >
                <span>{batch.name}</span>
                <span className="text-sm text-muted-foreground">
                  {batch.quantity_remaining} left ·{" "}
                  {formatCurrency(batch.selling_price)}
                </span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={!pendingProduct || !selectedBatchId || isLoadingBatches}
              onClick={() => {
                const batch = batches.find((row) => row.id === selectedBatchId);
                if (pendingProduct && batch) {
                  addProductToCart(pendingProduct, batch);
                }
                setBatchDialogOpen(false);
                setPendingProduct(null);
              }}
            >
              Add to cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual item */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add manual item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
                placeholder="Service / custom item"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Price ₹</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={manualPrice}
                  onChange={(event) => setManualPrice(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Qty</Label>
                <Input
                  type="number"
                  min={1}
                  value={manualQty}
                  onChange={(event) => setManualQty(event.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setManualDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddManual}>
              Add to cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post-save */}
      <Dialog
        open={Boolean(savedBill)}
        onOpenChange={(open) => {
          if (!open) setSavedBill(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bill saved</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {savedBill?.billNumber
              ? `Bill ${savedBill.billNumber} was created successfully.`
              : "Bill was created successfully."}
          </p>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSavedBill(null)}
            >
              New bill
            </Button>
            {savedBill ? (
              <Button type="button" asChild>
                <Link
                  href={`/sales/${savedBill.id}/receipt`}
                  target="_blank"
                  onClick={() => setSavedBill(null)}
                >
                  <Printer />
                  Print receipt
                </Link>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CartRow({
  item,
  onQtyChange,
  onRemove,
}: {
  item: CartItem;
  onQtyChange: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">
          {item.productName}
          {item.isManual ? (
            <span className="ml-1 text-[10px] font-semibold text-muted-foreground uppercase">
              Manual
            </span>
          ) : null}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {formatCurrency(item.unitPrice)}
          {item.batchName ? ` · ${item.batchName}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => onQtyChange(item.id, item.quantity - 1)}
        >
          <Minus />
        </Button>
        <span className="w-8 text-center text-[13px] tabular-nums">
          {item.quantity}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => onQtyChange(item.id, item.quantity + 1)}
        >
          <Plus />
        </Button>
      </div>
      <span className="w-20 shrink-0 text-[13px] font-semibold tabular-nums">
        {formatCurrency(item.unitPrice * item.quantity)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onRemove(item.id)}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
