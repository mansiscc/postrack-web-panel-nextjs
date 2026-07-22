"use client";

import { Loader2, Minus, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  getProductBatchesAction,
  saveBillAction,
} from "@/features/billing/actions";
import { useBillingCart } from "@/features/billing/hooks/use-billing-cart";
import type { CartItem } from "@/features/billing/types";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  const [search, setSearch] = useState("");
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
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

  const addProductToCart = (product: BillingProduct, batch?: BatchOption) => {
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
  };

  const handleProductClick = (product: BillingProduct) => {
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
  };

  const handleSave = () => {
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

      toast.success(`Bill saved (${result.data.billNumber ?? result.data.id})`);
      clearCart();
    });
  };

  return (
    <>
      <PageHeader
        title="POS Billing"
        description="Search products, build a cart, and process payment."
      />

      <div className="grid min-h-[calc(100vh-12rem)] gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <Card className="overflow-hidden">
          <CardContent className="flex h-full flex-col gap-3 p-4">
            <div className="relative">
              <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search or scan barcode…"
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleProductClick(product)}
                  className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Stock {product.stock_quantity}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(product.selling_price)}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="flex h-full flex-col p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium">Cart ({cart.items.length})</h2>
              {cart.items.length > 0 ? (
                <Button type="button" variant="ghost" size="sm" onClick={clearCart}>
                  Clear
                </Button>
              ) : null}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto">
              {cart.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add products from the catalog to start a bill.
                </p>
              ) : (
                cart.items.map((item) => (
                  <CartRow
                    key={item.id}
                    item={item}
                    onQtyChange={updateItemQty}
                    onRemove={removeItem}
                  />
                ))
              )}
            </div>
            <div className="mt-4 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatCurrency(totals.subtotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4">
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
                <SelectTrigger>
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

            <div className="grid grid-cols-2 gap-2">
              <div>
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
              <div>
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
                    <SelectTrigger className="w-24">
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
                      patchCart({ discountValue: Number(event.target.value || 0) })
                    }
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>Payment mode</Label>
              <Select
                value={cart.paymentMode}
                onValueChange={(value) =>
                  patchCart({
                    paymentMode: value as typeof cart.paymentMode,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["Cash", "UPI", "Card", "Mixed"] as const).map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {mode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {cart.paymentMode === "Mixed" ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
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
                <div>
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

            <div>
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

            <div>
              <Label>Account</Label>
              <Select
                value={cart.selectedAccountId}
                onValueChange={(value) => patchCart({ selectedAccountId: value })}
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

            <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span>Total payable</span>
                <span className="font-semibold tabular-nums">
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
                <div className="flex justify-between text-amber-600">
                  <span>Remaining</span>
                  <span className="tabular-nums">
                    {formatCurrency(totals.remainingAmount)}
                  </span>
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              className="w-full"
              disabled={isSaving || cart.items.length === 0}
              onClick={handleSave}
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving…
                </>
              ) : (
                "Review & save"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {batches.map((batch) => (
              <button
                key={batch.id}
                type="button"
                onClick={() => setSelectedBatchId(batch.id)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left ${
                  selectedBatchId === batch.id ? "border-primary bg-muted" : ""
                }`}
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
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.productName}</p>
        <p className="text-xs text-muted-foreground">
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
        <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => onQtyChange(item.id, item.quantity + 1)}
        >
          <Plus />
        </Button>
      </div>
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
