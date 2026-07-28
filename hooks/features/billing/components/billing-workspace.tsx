"use client";

import {
  ArrowRight,
  CreditCard,
  IndianRupee,
  Loader2,
  Minus,
  Percent,
  Plus,
  Printer,
  Search,
  Smartphone,
  Split,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

type BillingTotals = ReturnType<typeof calculateBillingTotals>;

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
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [savedBill, setSavedBill] = useState<SavedBillInfo | null>(null);
  const [pendingProduct, setPendingProduct] = useState<BillingProduct | null>(
    null,
  );
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [isSaving, startSave] = useTransition();
  const [isLoadingBatches, startBatchLoad] = useTransition();

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return products
      .filter(
        (product) =>
          product.name.toLowerCase().includes(term) ||
          (product.barcode?.toLowerCase().includes(term) ?? false),
      )
      .slice(0, 12);
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

  const totalItemQty = useMemo(
    () => cart.items.reduce((sum, item) => sum + item.quantity, 0),
    [cart.items],
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

  const handleAddManual = (name: string, price: number) => {
    addItem({
      productId: crypto.randomUUID(),
      productName: name,
      unitPrice: price,
      quantity: 1,
      isManual: true,
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
      setPaymentSheetOpen(false);

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

  const paymentPanel = (
    <PaymentPanel
      cart={cart}
      customers={customers}
      accounts={accounts}
      totals={totals}
      canSave={canSave}
      isSaving={isSaving}
      onPatch={patchCart}
      onSave={handleSave}
    />
  );

  return (
    <>
      <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col bg-surface-variant xl:flex-row">
        {/* Catalog — desktop only */}
        <section className="hidden min-h-0 w-full flex-col border-b border-border/60 bg-card shadow-card-sm xl:flex xl:w-[20%] xl:shrink-0 xl:border-r xl:border-b-0">
          <SearchAndManualSection
            searchRef={searchRef}
            search={search}
            onSearchChange={setSearch}
            onSearchEnter={handleBarcodeOrSearchEnter}
            onClearSearch={() => setSearch("")}
            onAddManual={handleAddManual}
            overlay={
              filteredProducts.length > 0 ? (
                <ProductSearchDropdown
                  products={filteredProducts}
                  onSelect={(product) => {
                    handleProductClick(product);
                    setSearch("");
                  }}
                />
              ) : null
            }
          />
          <CatalogProductList
            products={products}
            onProductClick={handleProductClick}
          />
        </section>

        {/* Mobile search + manual */}
        <div className="shrink-0 border-b border-border/60 bg-card p-3 shadow-card-sm xl:hidden">
          <SearchAndManualSection
            searchRef={searchRef}
            search={search}
            onSearchChange={setSearch}
            onSearchEnter={handleBarcodeOrSearchEnter}
            onClearSearch={() => setSearch("")}
            onAddManual={handleAddManual}
            overlay={
              filteredProducts.length > 0 ? (
                <ProductSearchDropdown
                  products={filteredProducts}
                  onSelect={(product) => {
                    handleProductClick(product);
                    setSearch("");
                  }}
                />
              ) : null
            }
          />
        </div>

        {/* Cart */}
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col xl:w-[55%] xl:flex-none">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 bg-card px-4">
            <h2 className="text-sm font-semibold text-foreground">Items</h2>
            {cart.items.length > 0 ? (
              <button
                type="button"
                onClick={clearCart}
                className="rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary-muted"
              >
                Clear Bill
              </button>
            ) : null}
          </div>

          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto p-3",
              cart.items.length > 0 && "pb-20 xl:pb-3",
            )}
          >
            {cart.items.length === 0 ? (
              <div className="flex h-full min-h-48 items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  No items added
                </p>
              </div>
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

          {/* Desktop subtotal strip */}
          <div className="hidden shrink-0 items-center justify-between border-t border-border/60 bg-card px-4 py-3 shadow-card-sm xl:flex">
            <span className="text-sm font-medium text-muted-foreground">
              Subtotal
            </span>
            <span className="text-base font-bold tabular-nums text-primary">
              {formatCurrency(totals.subtotal)}
            </span>
          </div>

          {/* Mobile sticky total */}
          {cart.items.length > 0 ? (
            <StickyBillingTotal
              totalItems={totalItemQty}
              totalAmount={totals.subtotal}
              onClick={() => setPaymentSheetOpen(true)}
              className="xl:hidden"
            />
          ) : null}
        </section>

        {/* Payment — desktop */}
        <section className="hidden min-h-0 shrink-0 flex-col overflow-y-auto border-l border-border/60 bg-card shadow-card-sm xl:flex xl:w-[25%]">
          {paymentPanel}
        </section>
      </div>

      {/* Payment — mobile sheet */}
      <Sheet open={paymentSheetOpen} onOpenChange={setPaymentSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] overflow-y-auto rounded-t-2xl p-0"
        >
          <SheetHeader className="border-b border-border/60 px-4 py-3">
            <SheetTitle>Payment</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto">{paymentPanel}</div>
        </SheetContent>
      </Sheet>

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
                  "flex w-full items-center justify-between rounded-xl border border-border px-3 py-2.5 text-left transition-colors",
                  selectedBatchId === batch.id &&
                    "border-primary bg-primary-light/50",
                )}
              >
                <span className="text-sm font-medium">{batch.name}</span>
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

function SearchAndManualSection({
  searchRef,
  search,
  onSearchChange,
  onSearchEnter,
  onClearSearch,
  onAddManual,
  overlay,
}: {
  searchRef: React.RefObject<HTMLInputElement | null>;
  search: string;
  onSearchChange: (value: string) => void;
  onSearchEnter: () => void;
  onClearSearch: () => void;
  onAddManual: (name: string, price: number) => void;
  overlay: ReactNode;
}) {
  return (
    <div className="space-y-2 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSearchEnter();
            }
          }}
          placeholder="Search product/scan barcode"
          className="h-11 pl-9 pr-9"
          autoFocus
        />
        {search ? (
          <button
            type="button"
            onClick={onClearSearch}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        ) : null}
        {overlay ? (
          <div className="absolute top-full right-0 left-0 z-30 mt-1">
            {overlay}
          </div>
        ) : null}
      </div>
      <ManualInlineAddRow onAdd={onAddManual} />
    </div>
  );
}

function ManualInlineAddRow({
  onAdd,
}: {
  onAdd: (name: string, price: number) => void;
}) {
  const [name, setName] = useState("");
  const [priceText, setPriceText] = useState("");

  const price = Number(priceText) || 0;
  const canAdd = name.trim().length > 0 && price > 0;

  const tryAdd = () => {
    if (!canAdd) return;
    onAdd(name.trim(), price);
    setName("");
    setPriceText("");
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="e.g. Custom service, packing charge"
        className="h-11 min-w-0 flex-1"
        onKeyDown={(event) => {
          if (event.key === "Enter") tryAdd();
        }}
      />
      <Input
        value={priceText}
        onChange={(event) => {
          const filtered = event.target.value.replace(/[^\d.]/g, "");
          const parts = filtered.split(".");
          const sanitized =
            parts.length > 2
              ? `${parts[0]}.${parts.slice(1).join("")}`
              : filtered;
          setPriceText(sanitized);
        }}
        placeholder="0.00"
        inputMode="decimal"
        className="h-11 w-20 shrink-0"
        onKeyDown={(event) => {
          if (event.key === "Enter") tryAdd();
        }}
      />
      <button
        type="button"
        disabled={!canAdd}
        onClick={tryAdd}
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors",
          canAdd
            ? "bg-primary/85 text-primary-foreground shadow-primary hover:bg-primary"
            : "border border-primary/20 bg-primary-light text-primary/40",
        )}
        aria-label="Add manual item"
      >
        <Plus className="size-5" />
      </button>
    </div>
  );
}

function ProductSearchDropdown({
  products,
  onSelect,
}: {
  products: BillingProduct[];
  onSelect: (product: BillingProduct) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-primary/20 bg-card shadow-card">
      <ul className="max-h-72 overflow-y-auto">
        {products.map((product, index) => (
          <li key={product.id}>
            <button
              type="button"
              onClick={() => onSelect(product)}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
            >
              <span className="min-w-0 truncate text-sm font-medium">
                {product.name}
              </span>
              <span className="shrink-0 text-sm font-semibold text-primary tabular-nums">
                {formatCurrency(product.selling_price)}
              </span>
            </button>
            {index < products.length - 1 ? (
              <div className="mx-4 border-t border-border/60" />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CatalogProductList({
  products,
  onProductClick,
}: {
  products: BillingProduct[];
  onProductClick: (product: BillingProduct) => void;
}) {
  const sorted = useMemo(
    () =>
      [...products]
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 80),
    [products],
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-2">
      {sorted.length === 0 ? (
        <p className="px-2 py-8 text-center text-sm text-muted-foreground">
          No products in catalog
        </p>
      ) : (
        <div className="space-y-1">
          {sorted.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => onProductClick(product)}
              className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-primary-light/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{product.name}</p>
                <p
                  className={cn(
                    "text-xs tabular-nums",
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
              <span className="shrink-0 text-sm font-semibold text-primary tabular-nums">
                {formatCurrency(product.selling_price)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StickyBillingTotal({
  totalItems,
  totalAmount,
  onClick,
  className,
}: {
  totalItems: number;
  totalAmount: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute right-0 bottom-0 left-0 flex items-center justify-between rounded-t-2xl border-t border-border/60 bg-card px-5 py-3.5 shadow-card-lg transition-colors hover:bg-muted/30",
        className,
      )}
    >
      <span className="text-sm font-medium text-foreground">
        Items: {totalItems}
      </span>
      <span className="flex items-center gap-2">
        <span className="text-sm font-semibold text-primary">Total:</span>
        <span className="text-base font-bold text-primary tabular-nums">
          {formatCurrency(totalAmount)}
        </span>
        <ArrowRight className="size-5 text-primary" />
      </span>
    </button>
  );
}

type CartState = ReturnType<typeof useBillingCart>["cart"];

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function sanitizeDecimalInput(raw: string): string {
  const filtered = raw.replace(/[^\d.]/g, "");
  const parts = filtered.split(".");
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : filtered;
}

function DecimalInput({
  value,
  onValueChange,
  placeholder = "0.00",
  className,
  readOnly,
}: {
  value: number;
  onValueChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}) {
  const [text, setText] = useState(value > 0 ? String(value) : "");
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (isFocusedRef.current) return;
    setText(value > 0 ? String(value) : "");
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      readOnly={readOnly}
      placeholder={placeholder}
      value={text}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        if (value <= 0) setText("");
      }}
      onChange={(event) => {
        const sanitized = sanitizeDecimalInput(event.target.value);
        setText(sanitized);
        onValueChange(Number(sanitized) || 0);
      }}
      className={className}
    />
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[13px] font-medium text-muted-foreground">{children}</p>
  );
}

function CustomerDetailsFields({
  customers,
  customerId,
  customerName,
  customerPhone,
  onPatch,
}: {
  customers: CustomerRow[];
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  onPatch: ReturnType<typeof useBillingCart>["patchCart"];
}) {
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebouncedValue(searchQuery, 300);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId) ?? null,
    [customers, customerId],
  );

  const searchResults = useMemo(() => {
    const query = debouncedQuery.trim().toLowerCase();
    if (!query) return [];
    return customers
      .filter(
        (customer) =>
          customer.name.toLowerCase().includes(query) ||
          customer.phone.includes(query),
      )
      .slice(0, 8);
  }, [customers, debouncedQuery]);

  const showPhoneDropdown = phoneFocused && searchResults.length > 0;
  const showNameDropdown = nameFocused && searchResults.length > 0;

  const selectCustomer = (customer: CustomerRow) => {
    onPatch({
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
    });
    setSearchQuery("");
    setPhoneFocused(false);
    setNameFocused(false);
  };

  return (
    <div className="space-y-2">
      <SectionLabel>Customer Details</SectionLabel>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="relative">
          <Label className="text-xs text-muted-foreground">Phone</Label>
          <Input
            value={customerPhone}
            onChange={(event) => {
              const sanitized = event.target.value.replace(/\D/g, "").slice(0, 10);
              onPatch({ customerPhone: sanitized, customerId: null });
              setSearchQuery(sanitized);
            }}
            onFocus={() => {
              setPhoneFocused(true);
              setNameFocused(false);
              setSearchQuery(customerPhone);
            }}
            onBlur={() => {
              window.setTimeout(() => setPhoneFocused(false), 150);
            }}
            placeholder="Phone"
            inputMode="numeric"
            className="mt-1"
          />
          {showPhoneDropdown ? (
            <CustomerSuggestionList
              customers={searchResults}
              selectedCustomerId={customerId}
              onSelect={selectCustomer}
            />
          ) : null}
        </div>

        <div className="relative">
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input
            value={customerName}
            onChange={(event) => {
              onPatch({ customerName: event.target.value, customerId: null });
              setSearchQuery(event.target.value);
            }}
            onFocus={() => {
              setNameFocused(true);
              setPhoneFocused(false);
              setSearchQuery(customerName);
            }}
            onBlur={() => {
              window.setTimeout(() => setNameFocused(false), 150);
            }}
            placeholder="Name"
            className="mt-1"
          />
          {showNameDropdown ? (
            <CustomerSuggestionList
              customers={searchResults}
              selectedCustomerId={customerId}
              onSelect={selectCustomer}
            />
          ) : null}
        </div>
      </div>

      {selectedCustomer ? (
        <p className="text-[11px] text-muted-foreground">
          {selectedCustomer.phone === customerPhone &&
          selectedCustomer.name !== customerName
            ? "This will update the selected customer's name."
            : selectedCustomer.phone !== customerPhone && customerPhone
              ? "Phone changed, this will be treated as another customer."
              : null}
        </p>
      ) : customerName || customerPhone ? (
        <p className="text-[11px] text-muted-foreground">Walk-in customer</p>
      ) : null}
    </div>
  );
}

function CustomerSuggestionList({
  customers,
  selectedCustomerId,
  onSelect,
}: {
  customers: CustomerRow[];
  selectedCustomerId: string | null;
  onSelect: (customer: CustomerRow) => void;
}) {
  return (
    <div className="absolute top-full right-0 left-0 z-40 mt-1 overflow-hidden rounded-xl border border-border/60 bg-card shadow-card">
      <ul className="max-h-56 overflow-y-auto">
        {customers.map((customer, index) => (
          <li key={customer.id}>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(customer)}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                selectedCustomerId === customer.id && "bg-primary-light/60",
              )}
            >
              <span className="text-sm font-medium">{customer.name}</span>
              <span className="text-xs text-muted-foreground">
                {customer.phone}
              </span>
            </button>
            {index < customers.length - 1 ? (
              <div className="mx-3 border-t border-border/60" />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiscountTypeToggle({
  value,
  onChange,
}: {
  value: "AMOUNT" | "PERCENT";
  onChange: (value: "AMOUNT" | "PERCENT") => void;
}) {
  return (
    <div className="flex shrink-0 rounded-xl border border-border/60 bg-surface-variant p-0.5">
      {(
        [
          { type: "AMOUNT" as const, icon: IndianRupee, label: "Discount amount" },
          { type: "PERCENT" as const, icon: Percent, label: "Discount percentage" },
        ] as const
      ).map(({ type, icon: Icon, label }) => {
        const selected = value === type;
        return (
          <button
            key={type}
            type="button"
            title={label}
            onClick={() => onChange(type)}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg transition-colors",
              selected
                ? "border border-primary/20 bg-primary-light text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

function PaymentPanel({
  cart,
  customers,
  accounts,
  totals,
  canSave,
  isSaving,
  onPatch,
  onSave,
}: {
  cart: CartState;
  customers: CustomerRow[];
  accounts: AccountRow[];
  totals: BillingTotals;
  canSave: boolean;
  isSaving: boolean;
  onPatch: ReturnType<typeof useBillingCart>["patchCart"];
  onSave: () => void;
}) {
  const discountType = cart.discountType ?? "AMOUNT";
  const billTotal = totals.subtotal + totals.otherItemsAmount;

  useEffect(() => {
    if (cart.paymentMode === "Mixed") {
      onPatch({
        receivedAmount: Number(
          (cart.mixedCashAmount + cart.mixedUpiAmount).toFixed(2),
        ),
      });
    }
  }, [cart.paymentMode, cart.mixedCashAmount, cart.mixedUpiAmount, onPatch]);

  return (
    <>
      <div className="space-y-3.5 border-b border-border/60 p-4">
        <CustomerDetailsFields
          customers={customers}
          customerId={cart.customerId}
          customerName={cart.customerName}
          customerPhone={cart.customerPhone}
          onPatch={onPatch}
        />
      </div>

      <div className="space-y-3.5 border-b border-border/60 p-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Account</Label>
          <Select
            value={cart.selectedAccountId || undefined}
            onValueChange={(value) => onPatch({ selectedAccountId: value })}
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

      <div className="space-y-3.5 border-b border-border/60 p-4">
        <SectionLabel>Payment Mode</SectionLabel>
        <div className="grid grid-cols-4 gap-1.5">
          {(
            [
              { mode: "Cash" as const, icon: Wallet },
              { mode: "UPI" as const, icon: Smartphone },
              { mode: "Card" as const, icon: CreditCard },
              { mode: "Mixed" as const, icon: Split },
            ] as const
          ).map(({ mode, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => onPatch({ paymentMode: mode })}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center text-[11px] font-medium transition-colors",
                cart.paymentMode === mode
                  ? "border-primary bg-primary-light text-primary shadow-card-sm"
                  : "border-border bg-card hover:bg-muted/50",
              )}
            >
              <Icon className="size-4" />
              {mode}
            </button>
          ))}
        </div>

        {cart.paymentMode === "Mixed" ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cash</Label>
              <DecimalInput
                value={cart.mixedCashAmount}
                onValueChange={(value) => onPatch({ mixedCashAmount: value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">UPI</Label>
              <DecimalInput
                value={cart.mixedUpiAmount}
                onValueChange={(value) => onPatch({ mixedUpiAmount: value })}
                placeholder="0.00"
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-3.5 border-b border-border/60 p-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Other Items Price
          </Label>
          <DecimalInput
            value={cart.otherItemsAmount}
            onValueChange={(value) => onPatch({ otherItemsAmount: value })}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-1.5">
          <SectionLabel>Discount</SectionLabel>
          <div className="flex gap-2">
            <DecimalInput
              value={cart.discountValue}
              onValueChange={(value) => onPatch({ discountValue: value })}
              placeholder={discountType === "PERCENT" ? "0.0" : "0.00"}
              className="min-w-0 flex-1"
            />
            <DiscountTypeToggle
              value={discountType}
              onChange={(value) => onPatch({ discountType: value })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <SectionLabel>Received Amount</SectionLabel>
          <DecimalInput
            value={cart.receivedAmount}
            onValueChange={(value) => onPatch({ receivedAmount: value })}
            placeholder={
              cart.paymentMode === "Mixed"
                ? "Auto calculated"
                : "Enter received amount"
            }
            readOnly={cart.paymentMode === "Mixed"}
          />
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="space-y-2 rounded-xl bg-surface-variant p-3.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bill Total</span>
            <span className="tabular-nums">{formatCurrency(billTotal)}</span>
          </div>
          <div className="flex justify-between text-primary">
            <span>Discount</span>
            <span className="tabular-nums">
              −{formatCurrency(totals.discountAmount)}
            </span>
          </div>
          <div className="flex justify-between border-t border-border/60 pt-2">
            <span className="font-semibold">Total Payable</span>
            <span className="font-bold text-primary tabular-nums">
              {formatCurrency(totals.totalPayable)}
            </span>
          </div>
          {totals.remainingAmount > 0 ? (
            <div className="flex justify-between text-primary">
              <span>Remaining</span>
              <span className="tabular-nums">
                {formatCurrency(totals.remainingAmount)}
              </span>
            </div>
          ) : totals.changeAmount > 0 ? (
            <p className="text-center text-sm font-medium text-success">
              Give back to customer {formatCurrency(totals.changeAmount)}
            </p>
          ) : totals.receivedAmount >= totals.totalPayable &&
            totals.totalPayable > 0 ? (
            <p className="text-center text-sm font-medium text-success">
              Payment settled
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          className="h-11 w-full"
          disabled={isSaving || !canSave}
          onClick={onSave}
        >
          {isSaving ? (
            <>
              <Loader2 className="animate-spin" />
              Saving…
            </>
          ) : (
            "Generate Bill"
          )}
        </Button>
      </div>
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
  const [qtyText, setQtyText] = useState(String(item.quantity));

  useEffect(() => {
    setQtyText(String(item.quantity));
  }, [item.quantity]);

  const subtitle = item.isManual
    ? "Manual item"
    : item.batchName
      ? `Batch ${item.batchName}`
      : item.barcode ?? "";

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-card-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
          {item.productName}
        </p>
        <span className="shrink-0 text-sm font-semibold text-primary tabular-nums">
          {formatCurrency(item.unitPrice * item.quantity)}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatCurrency(item.unitPrice)}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (item.quantity <= 1) {
                onRemove(item.id);
                return;
              }
              onQtyChange(item.id, item.quantity - 1);
            }}
            className="flex size-7 items-center justify-center rounded-lg bg-primary/80 text-primary-foreground transition-colors hover:bg-primary"
            aria-label="Decrease quantity"
          >
            <Minus className="size-4" />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={qtyText}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "");
              setQtyText(digits);
              if (!digits || digits === "0") {
                onRemove(item.id);
                return;
              }
              const parsed = Number(digits);
              if (parsed > 0) onQtyChange(item.id, parsed);
            }}
            onBlur={() => {
              if (!qtyText || qtyText === "0") {
                onRemove(item.id);
              }
            }}
            className="h-7 w-9 rounded-md border border-primary/20 bg-card text-center text-sm font-medium text-primary tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            aria-label="Quantity"
          />
          <button
            type="button"
            onClick={() => onQtyChange(item.id, item.quantity + 1)}
            className="flex size-7 items-center justify-center rounded-lg bg-primary/80 text-primary-foreground transition-colors hover:bg-primary"
            aria-label="Increase quantity"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
