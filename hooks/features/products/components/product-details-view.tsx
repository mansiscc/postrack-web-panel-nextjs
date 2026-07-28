"use client";

import {
  BarChart3,
  History,
  ImageIcon,
  Package,
  Pencil,
  QrCode,
  RotateCcw,
  Trash2,
  TrendingUp,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import {
  deleteProductAction,
  restoreProductAction,
} from "@/hooks/features/products/actions";
import { ProductFormSheet } from "@/hooks/features/products/components/product-form-sheet";
import {
  getStockStatus,
  type ProductDetailsPayload,
  type ProductListItem,
  type ProductMovement,
} from "@/hooks/features/products/types";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { StatusBadge } from "@/components/forms/status-badge";
import { useTopbarChrome } from "@/components/layout/topbar-chrome";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/utils/currency";
import { formatDateTime } from "@/utils/date";

type CategoryOption = { id: string; name: string };

type ProductDetailsViewProps = {
  product: ProductListItem;
  details: ProductDetailsPayload;
  categories: CategoryOption[];
  canDelete: boolean;
};

type ActivityTab = "purchases" | "sales" | "returns";

function formatQty(value: number) {
  return Number.isInteger(value) ? String(value) : formatNumber(value);
}

function displayBarcode(barcode: string | null) {
  if (!barcode?.trim()) return null;
  const raw = barcode.trim();
  const stripped = raw.replace(/^AUTO/i, "");
  return stripped || raw;
}

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
      <h2 className="text-[13px] font-bold text-foreground">{title}</h2>
    </div>
  );
}

function DetailsSection({
  icon,
  title,
  children,
  className,
}: {
  icon: React.ElementType;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <SectionLabel icon={icon} title={title} />
      <div className="rounded-lg bg-card p-4 shadow-card">{children}</div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  unit,
  valueClassName,
  containerClassName,
  labelClassName,
  unitClassName,
}: {
  label: string;
  value: string;
  unit: string;
  valueClassName?: string;
  containerClassName?: string;
  labelClassName?: string;
  unitClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 rounded-md px-2 py-2.5 text-center",
        containerClassName,
      )}
    >
      <span
        className={cn(
          "text-[10px] font-medium text-muted-foreground",
          labelClassName,
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-[15px] font-bold tabular-nums text-primary",
          valueClassName,
        )}
      >
        {value}
      </span>
      <span
        className={cn(
          "text-[10px] text-muted-foreground",
          unitClassName,
        )}
      >
        {unit}
      </span>
    </div>
  );
}

function PriceCell({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-[13px] font-bold tabular-nums",
          emphasize ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function FinancialRow({
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
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-[13px] tabular-nums text-foreground",
          bold ? "font-semibold" : "font-medium",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}

function SegmentedTabs({
  items,
  value,
  onChange,
  className,
}: {
  items: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-9 gap-0.5 rounded-md bg-card p-0.5 shadow-card-sm",
        className,
      )}
      role="tablist"
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.value)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors",
              selected
                ? "bg-primary-muted font-semibold text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {item.count != null ? (
              <span
                className={cn(
                  "rounded px-1.5 py-px text-[10px] font-semibold tabular-nums",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-variant text-muted-foreground",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function ActivityEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/70 px-4 py-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function groupPurchasesByBatch(movements: ProductMovement[]) {
  const groups = new Map<
    string,
    {
      batchId: string | null;
      batchSeq: number | null;
      purchasePrice: number | null;
      sellingPrice: number | null;
      mrp: number | null;
      entries: ProductMovement[];
    }
  >();

  for (const movement of movements) {
    const key = movement.batch_id ?? `none-${movement.id}`;
    const existing = groups.get(key);
    if (existing) {
      existing.entries.push(movement);
      continue;
    }
    groups.set(key, {
      batchId: movement.batch_id,
      batchSeq: movement.batch_seq,
      purchasePrice: movement.unit_price,
      sellingPrice: movement.selling_price,
      mrp: movement.mrp,
      entries: [movement],
    });
  }

  return Array.from(groups.values());
}

function isPurchaseType(type: string) {
  return (
    type === "OPENING" ||
    type === "PURCHASE" ||
    type === "ADJUSTMENT_IN"
  );
}

function isReturnType(type: string) {
  return type === "RETURN_IN" || type === "RETURN_OUT";
}

export function ProductDetailsView({
  product,
  details,
  categories,
  canDelete,
}: ProductDetailsViewProps) {
  const router = useRouter();
  const { setChrome, clearChrome } = useTopbarChrome();
  const [activityTab, setActivityTab] = useState<ActivityTab>("purchases");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteProductAction(product.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Product deleted");
      setDeleteOpen(false);
      router.push("/products");
      router.refresh();
    });
  };

  const handleRestore = () => {
    startTransition(async () => {
      const result = await restoreProductAction(product.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Product restored successfully");
      router.refresh();
    });
  };

  useEffect(() => {
    setChrome({
      title: product.name,
      actions: product.isDeleted ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={handleRestore}
        >
          <RotateCcw />
          Restore
        </Button>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFormOpen(true)}
          >
            <Pencil />
            Edit
          </Button>
          {canDelete ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 />
              Delete
            </Button>
          ) : null}
        </>
      ),
    });

    return () => clearChrome();
  }, [
    product.name,
    product.isDeleted,
    product.id,
    canDelete,
    isPending,
    setChrome,
    clearChrome,
  ]);

  const unitLabel = product.unit || "Units";
  const categoryName = details.category_name || product.categoryName || "Uncategorized";
  const barcode = displayBarcode(product.barcode);
  const stockStatus = getStockStatus(product);
  const stockSummary = details.stock_summary;
  const financial = details.financial_summary;
  const hasSalesData =
    financial.units_sold > 0 ||
    financial.sales_revenue > 0 ||
    financial.net_units_sold > 0;

  const totalReceived = stockSummary.total_received;
  const stockLevelPercent =
    totalReceived > 0
      ? Math.min(1, Math.max(0, product.stockQuantity / totalReceived))
      : product.stockQuantity > 0
        ? 1
        : 0;

  const stockMeta = {
    out: {
      label: "Out Of Stock",
      color: "text-destructive",
      badge: "bg-destructive-muted text-destructive",
      bar: "bg-destructive",
    },
    low: {
      label: "Low Stock",
      color: "text-warning-icon",
      badge: "bg-warning-muted text-warning-icon",
      bar: "bg-warning",
    },
    ok: {
      label: "In Stock",
      color: "text-success-icon",
      badge: "bg-success-muted text-success-icon",
      bar: "bg-success",
    },
  }[stockStatus];

  const statusLabel = product.isDeleted
    ? "Deleted"
    : product.isActive
      ? "Active"
      : "Inactive";
  const statusPositive = product.isActive && !product.isDeleted;

  const movements = details.movements;
  const purchases = useMemo(
    () => movements.filter((m) => isPurchaseType(m.transaction_type)),
    [movements],
  );
  const sales = useMemo(
    () => movements.filter((m) => m.transaction_type === "SALE"),
    [movements],
  );
  const returns = useMemo(
    () => movements.filter((m) => isReturnType(m.transaction_type)),
    [movements],
  );
  const purchaseBatches = useMemo(
    () => groupPurchasesByBatch(purchases),
    [purchases],
  );

  const profitPositive = financial.gross_profit > 0;
  const profitNegative = financial.gross_profit < 0;

  return (
    <div className="w-full space-y-4">
      {/* Identity hero */}
      <div className="rounded-lg bg-card p-4 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-surface-variant sm:size-24">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <ImageIcon className="size-7" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <h2 className="text-base font-semibold tracking-tight sm:text-lg">
              {product.name}
            </h2>
            <p className="text-[12px] font-medium text-muted-foreground">
              {categoryName} · {unitLabel}
            </p>
            {barcode ? (
              <div className="flex items-center gap-1.5 text-primary">
                <QrCode className="size-3.5" />
                <span className="font-mono text-[12px] font-semibold">
                  {barcode}
                </span>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <StatusBadge
                status={statusPositive ? "active" : "inactive"}
                label={statusLabel}
              />
              <span
                className={cn(
                  "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  stockMeta.badge,
                )}
              >
                {stockMeta.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:items-start">
        <DetailsSection
          icon={BarChart3}
          title="Performance"
        >
          <div className="flex gap-2">
            <MetricTile
              label="Received"
              value={formatQty(stockSummary.total_received)}
              unit={unitLabel}
              containerClassName="bg-primary-muted"
              labelClassName="text-primary"
              unitClassName="text-primary/80"
            />
            <MetricTile
              label="Sold"
              value={formatQty(stockSummary.total_sold)}
              unit={unitLabel}
              containerClassName="bg-primary-muted"
              labelClassName="text-primary"
              unitClassName="text-primary/80"
            />
            {stockSummary.total_returned > 0 ? (
              <MetricTile
                label="Returned"
                value={formatQty(stockSummary.total_returned)}
                unit={unitLabel}
                containerClassName="bg-primary-muted"
                labelClassName="text-primary"
                unitClassName="text-primary/80"
              />
            ) : null}
          </div>
        </DetailsSection>

        <DetailsSection icon={Package} title="Pricing">
          <p className="mb-3 text-[11px] text-muted-foreground">
            Current catalog prices used for billing and profit.
          </p>
          <div className="flex items-center">
            <PriceCell
              label="MRP"
              value={product.mrp == null ? "—" : formatCurrency(product.mrp)}
            />
            <div className="h-7 w-px bg-border" />
            <PriceCell
              label="Purchase Price"
              value={
                product.purchasePrice == null
                  ? "—"
                  : formatCurrency(product.purchasePrice)
              }
            />
            <div className="h-7 w-px bg-border" />
            <PriceCell
              label="Selling price"
              value={
                product.sellingPrice == null
                  ? "—"
                  : formatCurrency(product.sellingPrice)
              }
              emphasize
            />
          </div>
        </DetailsSection>

        <DetailsSection icon={Package} title="Inventory">
          <div className="mb-3 flex gap-2">
            <MetricTile
              label="Current"
              value={formatQty(product.stockQuantity)}
              unit={unitLabel}
              valueClassName={stockMeta.color}
              containerClassName="bg-primary-muted"
            />
            <MetricTile
              label="Opening"
              value={formatQty(stockSummary.opening_stock)}
              unit={unitLabel}
              valueClassName="text-foreground"
              containerClassName="bg-surface-variant"
            />
            <MetricTile
              label="Low Alert"
              value={formatQty(product.lowStockAlertQty)}
              unit={unitLabel}
              valueClassName="text-warning-icon"
              containerClassName="bg-analytics-orange-tint"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">
                Stock level
              </span>
              <span className="text-[12px] font-semibold tabular-nums">
                {Math.round(stockLevelPercent * 100)}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className={cn("h-full rounded-full transition-all", stockMeta.bar)}
                style={{ width: `${Math.round(stockLevelPercent * 100)}%` }}
              />
            </div>
          </div>
        </DetailsSection>

        <DetailsSection icon={TrendingUp} title="Profit Summary">
          <p className="mb-3 text-[11px] text-muted-foreground">
            All-time from bills and returns.
          </p>
          {!hasSalesData ? (
            <p className="text-[13px] text-muted-foreground">
              No sales yet for this product.
            </p>
          ) : (
            <div className="space-y-3">
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-3",
                  profitPositive && "bg-success-muted",
                  profitNegative && "bg-warning-muted",
                  !profitPositive && !profitNegative && "bg-surface-variant",
                )}
              >
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    Your profit
                  </p>
                  <p
                    className={cn(
                      "text-lg font-bold tabular-nums",
                      profitPositive && "text-success-icon",
                      profitNegative && "text-warning-icon",
                    )}
                  >
                    {formatCurrency(financial.gross_profit)}
                  </p>
                </div>
                {financial.profit_margin_percent != null ? (
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">
                      Profit %
                    </p>
                    <p
                      className={cn(
                        "text-base font-bold tabular-nums",
                        profitPositive && "text-success-icon",
                        profitNegative && "text-warning-icon",
                      )}
                    >
                      {Math.round(financial.profit_margin_percent)}%
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <FinancialRow
                  label="Sales"
                  value={formatCurrency(financial.sales_revenue)}
                />
                {financial.return_amount > 0 ? (
                  <>
                    <FinancialRow
                      label="Returns"
                      value={`- ${formatCurrency(financial.return_amount)}`}
                      valueClassName="text-warning-icon"
                    />
                    <FinancialRow
                      label="Money received"
                      value={formatCurrency(financial.net_revenue)}
                      bold
                    />
                  </>
                ) : null}
                <FinancialRow
                  label="Product cost"
                  value={formatCurrency(financial.cost_of_goods_sold)}
                />
              </div>
            </div>
          )}
        </DetailsSection>
      </div>

      <DetailsSection icon={History} title="Activity">
        <div className="space-y-3">
          <SegmentedTabs
            value={activityTab}
            onChange={(value) => setActivityTab(value as ActivityTab)}
            className="w-full lg:max-w-lg"
            items={[
              {
                value: "purchases",
                label: "Purchases",
                count: purchases.length,
              },
              { value: "sales", label: "Sales", count: sales.length },
              { value: "returns", label: "Returns", count: returns.length },
            ]}
          />

          {activityTab === "purchases" ? (
            purchases.length === 0 ? (
              <ActivityEmpty message="No purchases yet." />
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {purchaseBatches.map((group) => {
                  const totalQty = group.entries.reduce(
                    (sum, entry) => sum + Math.abs(entry.quantity),
                    0,
                  );
                  const totalSpend = group.entries.reduce((sum, entry) => {
                    const line =
                      entry.line_total ??
                      (entry.unit_price != null
                        ? entry.unit_price * Math.abs(entry.quantity)
                        : 0);
                    return sum + line;
                  }, 0);
                  const batchLabel =
                    group.batchSeq != null
                      ? `Batch ${group.batchSeq}`
                      : "No batch";

                  return (
                    <div
                      key={group.batchId ?? group.entries[0]?.id}
                      className="rounded-lg border border-border/50 bg-surface-variant/40 p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[13px] font-semibold">
                            {batchLabel}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {group.entries.length} entries ·{" "}
                            {formatQty(totalQty)} {unitLabel}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground">
                            Total
                          </p>
                          <p className="text-[13px] font-semibold tabular-nums">
                            {formatCurrency(totalSpend)}
                          </p>
                        </div>
                      </div>

                      <div className="mb-3 grid grid-cols-3 gap-2">
                        <div className="rounded-md bg-card px-2 py-2 text-center">
                          <p className="text-[10px] text-muted-foreground">
                            Purchase
                          </p>
                          <p className="text-[12px] font-semibold tabular-nums">
                            {group.purchasePrice == null
                              ? "—"
                              : formatCurrency(group.purchasePrice)}
                          </p>
                        </div>
                        <div className="rounded-md bg-card px-2 py-2 text-center">
                          <p className="text-[10px] text-muted-foreground">
                            Sell
                          </p>
                          <p className="text-[12px] font-semibold tabular-nums">
                            {group.sellingPrice == null
                              ? "—"
                              : formatCurrency(group.sellingPrice)}
                          </p>
                        </div>
                        <div className="rounded-md bg-card px-2 py-2 text-center">
                          <p className="text-[10px] text-muted-foreground">
                            MRP
                          </p>
                          <p className="text-[12px] font-semibold tabular-nums">
                            {group.mrp == null
                              ? "—"
                              : formatCurrency(group.mrp)}
                          </p>
                        </div>
                      </div>

                      <div className="divide-y divide-border/60">
                        {group.entries.map((movement) => {
                          const qty = Math.abs(movement.quantity);
                          const typeLabel =
                            movement.transaction_type === "OPENING"
                              ? "Opening Stock"
                              : movement.transaction_type === "ADJUSTMENT_IN"
                                ? "Adj. In"
                                : "Purchase";
                          const party =
                            movement.transaction_type === "OPENING"
                              ? null
                              : movement.party_name?.trim() ||
                                "Walk-in Purchase";
                          const document = movement.document_label
                            ?.trim()
                            ?.toLowerCase()
                            .includes("opening")
                            ? null
                            : movement.document_label;
                          const meta = [typeLabel, party, document]
                            .filter(Boolean)
                            .join(" · ");
                          const lineTotal =
                            movement.line_total ??
                            (movement.unit_price != null
                              ? movement.unit_price * qty
                              : null);

                          return (
                            <div key={movement.id} className="py-2.5">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-[12px] font-medium">
                                  {formatDateTime(movement.created_at)}
                                </p>
                                <p className="text-[12px] font-bold tabular-nums text-success-icon">
                                  +{formatQty(qty)} {unitLabel}
                                </p>
                              </div>
                              <div className="mt-0.5 flex items-center justify-between gap-3">
                                <p className="min-w-0 truncate text-[11px] text-muted-foreground">
                                  {meta}
                                </p>
                                {lineTotal != null ? (
                                  <p className="shrink-0 text-[12px] font-semibold tabular-nums">
                                    {formatCurrency(lineTotal)}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : null}

          {activityTab === "sales" ? (
            sales.length === 0 ? (
              <ActivityEmpty message="No sales yet." />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border/50 bg-surface-variant/40 divide-y divide-border/60">
                {sales.map((movement) => {
                  const qty = Math.abs(movement.quantity);
                  const party =
                    !movement.party_name?.trim() ||
                    movement.party_name.toLowerCase() === "walk-in customer"
                      ? "Walk-in"
                      : movement.party_name;
                  const meta = [party, movement.document_label]
                    .filter(Boolean)
                    .join(" · ");
                  const lineTotal =
                    movement.line_total ??
                    (movement.unit_price != null
                      ? movement.unit_price * qty
                      : null);

                  return (
                    <div key={movement.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="text-[12px] font-medium">
                            {formatDateTime(movement.created_at)}
                          </p>
                          {movement.batch_name ||
                          movement.batch_seq != null ? (
                            <span className="rounded bg-analytics-orange-tint px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                              {movement.batch_name ||
                                `Batch ${movement.batch_seq}`}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[12px] font-bold tabular-nums text-primary">
                          -{formatQty(qty)} {unitLabel}
                        </p>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-[11px] text-muted-foreground">
                          {meta}
                        </p>
                        <div className="flex shrink-0 items-center gap-2">
                          {movement.unit_price != null ? (
                            <span className="text-[11px] text-muted-foreground">
                              @ {formatCurrency(movement.unit_price)}
                            </span>
                          ) : null}
                          {lineTotal != null ? (
                            <span className="text-[12px] font-semibold tabular-nums">
                              {formatCurrency(lineTotal)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : null}

          {activityTab === "returns" ? (
            returns.length === 0 ? (
              <ActivityEmpty message="No returns yet." />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border/50 bg-surface-variant/40 divide-y divide-border/60">
                {returns.map((movement) => {
                  const qty = Math.abs(movement.quantity);
                  const isIn = movement.quantity >= 0;
                  const meta = [
                    movement.party_name || "Walk-in",
                    movement.document_label,
                    movement.related_document_label
                      ? `Bill ${movement.related_document_label}`
                      : null,
                    movement.refund_method
                      ? `Refund: ${movement.refund_method}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <div key={movement.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[12px] font-medium">
                          {formatDateTime(movement.created_at)}
                        </p>
                        <p
                          className={cn(
                            "text-[12px] font-bold tabular-nums",
                            isIn ? "text-success-icon" : "text-primary",
                          )}
                        >
                          {isIn ? "+" : "-"}
                          {formatQty(qty)} {unitLabel}
                        </p>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {meta}
                      </p>
                    </div>
                  );
                })}
              </div>
            )
          ) : null}
        </div>
      </DetailsSection>

      <ProductFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        product={product}
        categories={categories}
        onSuccess={() => router.refresh()}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Product?"
        description="This product will be moved to Deleted. You can restore it later from the Deleted filter."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
