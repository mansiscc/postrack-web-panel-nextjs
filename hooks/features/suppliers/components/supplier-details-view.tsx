"use client";

import {
  Calendar,
  Contact,
  Info,
  Pencil,
  ReceiptText,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import {
  deleteSupplierAction,
  restoreSupplierAction,
} from "@/hooks/features/suppliers/actions";
import { SupplierFormSheet } from "@/hooks/features/suppliers/components/supplier-form-sheet";
import type { SupplierListItem } from "@/hooks/features/suppliers/types";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { useTopbarChrome } from "@/components/layout/topbar-chrome";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/utils/currency";
import { formatDate } from "@/utils/date";

export type SupplierPurchaseItem = {
  id: string;
  date: string;
  invoice_number: string | null;
  notes: string | null;
  total_items: number;
  total_amount: number;
  created_at: string;
  created_by_name: string | null;
};

export type SupplierPurchaseSummary = {
  totalEntries: number;
  totalItems: number;
  totalAmount: number;
  lastPurchaseDate: string | null;
};

type SupplierDetailsViewProps = {
  supplier: SupplierListItem;
  purchases: SupplierPurchaseItem[];
  purchaseSummary: SupplierPurchaseSummary | null;
  canDelete: boolean;
};

type DetailsTab = "details" | "purchases";

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
}: {
  icon: React.ElementType;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <SectionLabel icon={icon} title={title} />
      <div className="rounded-lg bg-card p-4 shadow-card">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const display = value?.trim() ? value : "—";
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-[12px] text-muted-foreground">{label}</span>
      <span className="text-right text-[13px] font-semibold text-foreground">
        {display}
      </span>
    </div>
  );
}

function SegmentedTabs({
  items,
  value,
  onChange,
}: {
  items: { value: DetailsTab; label: string; count?: number }[];
  value: DetailsTab;
  onChange: (value: DetailsTab) => void;
}) {
  return (
    <div
      className="flex h-9 gap-0.5 rounded-md bg-card p-0.5 shadow-card-sm lg:hidden"
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

function PurchaseCard({ purchase }: { purchase: SupplierPurchaseItem }) {
  const isOpening = purchase.invoice_number === "OPENING";
  const title = isOpening ? "Opening Stock" : purchase.invoice_number || "Purchase";

  return (
    <div className="rounded-lg bg-card p-3.5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-[13px] font-semibold text-foreground">
            {title}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
            {!isOpening && purchase.invoice_number ? (
              <span className="inline-flex items-center gap-1">
                <ReceiptText className="size-3" />
                {purchase.invoice_number}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3" />
              {formatDate(purchase.date)}
            </span>
          </div>
        </div>
        <p className="shrink-0 text-[14px] font-bold tabular-nums text-primary">
          {formatCurrency(purchase.total_amount)}
        </p>
      </div>

      {purchase.notes?.trim() ? (
        <p className="mt-2 text-[12px] text-muted-foreground">{purchase.notes}</p>
      ) : null}

      {purchase.created_by_name || purchase.total_items > 0 ? (
        <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-border/60 pt-2.5">
          <span className="truncate text-[12px] text-muted-foreground">
            {purchase.created_by_name
              ? `By ${purchase.created_by_name}`
              : "—"}
          </span>
          {purchase.total_items > 0 ? (
            <span className="rounded-full bg-surface-variant px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {formatNumber(purchase.total_items)} items
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SupplierDetailsContent({ supplier }: { supplier: SupplierListItem }) {
  return (
    <div className="space-y-4">
      <DetailsSection icon={Info} title="Basic Info">
        <div className="space-y-3">
          <DetailRow label="Supplier Name" value={supplier.supplierName} />
          <DetailRow
            label="Contact Person Name"
            value={supplier.contactPerson}
          />
        </div>
      </DetailsSection>

      <DetailsSection icon={Contact} title="Contact Info">
        <div className="space-y-3">
          <DetailRow label="Phone" value={supplier.phone} />
          <DetailRow label="Email" value={supplier.email} />
          <DetailRow label="Address" value={supplier.address} />
          <DetailRow label="GST Number" value={supplier.gstNumber} />
        </div>
      </DetailsSection>
    </div>
  );
}

function SupplierPurchasesContent({
  purchases,
  purchaseSummary,
}: {
  purchases: SupplierPurchaseItem[];
  purchaseSummary: SupplierPurchaseSummary | null;
}) {
  return (
    <div className="space-y-4">
      <DetailsSection icon={ReceiptText} title="Purchase summary">
        {purchaseSummary ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryTile
              label="Total purchases"
              value={formatNumber(purchaseSummary.totalEntries)}
            />
            <SummaryTile
              label="Total items"
              value={formatNumber(purchaseSummary.totalItems)}
            />
            <SummaryTile
              label="Total amount"
              value={formatCurrency(purchaseSummary.totalAmount)}
            />
            <SummaryTile
              label="Last purchase"
              value={
                purchaseSummary.lastPurchaseDate
                  ? formatDate(purchaseSummary.lastPurchaseDate)
                  : "—"
              }
            />
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            No purchases recorded
          </p>
        )}
      </DetailsSection>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ReceiptText className="size-3.5 text-primary" strokeWidth={2.25} />
            <h2 className="text-[13px] font-bold text-foreground">
              Purchase history
            </h2>
          </div>
          {purchases.length > 0 ? (
            <span className="rounded-md bg-primary-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
              {purchases.length}
            </span>
          ) : null}
        </div>

        {purchases.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No purchase activity yet.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {purchases.map((purchase) => (
              <PurchaseCard key={purchase.id} purchase={purchase} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-variant px-3 py-2.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-[14px] font-bold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

export function SupplierDetailsView({
  supplier,
  purchases,
  purchaseSummary,
  canDelete,
}: SupplierDetailsViewProps) {
  const router = useRouter();
  const { setChrome, clearChrome } = useTopbarChrome();
  const [tab, setTab] = useState<DetailsTab>("details");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteSupplierAction(supplier.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Supplier deleted successfully");
      setDeleteOpen(false);
      router.refresh();
    });
  };

  const handleRestore = () => {
    startTransition(async () => {
      const result = await restoreSupplierAction(supplier.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Supplier restored successfully");
      router.refresh();
    });
  };

  useEffect(() => {
    setChrome({
      title: supplier.supplierName || "Supplier Details",
      actions: supplier.isDeleted ? (
        canDelete ? (
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
        ) : null
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
    supplier.supplierName,
    supplier.isDeleted,
    supplier.id,
    canDelete,
    isPending,
    setChrome,
    clearChrome,
  ]);

  return (
    <>
      <div className="w-full space-y-4">
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "details", label: "Details" },
            {
              value: "purchases",
              label: "Purchases",
              count: purchases.length,
            },
          ]}
        />

        {/* Mobile: tab panels */}
        <div className="lg:hidden">
          {tab === "details" ? (
            <SupplierDetailsContent supplier={supplier} />
          ) : (
            <SupplierPurchasesContent
              purchases={purchases}
              purchaseSummary={purchaseSummary}
            />
          )}
        </div>

        {/* Desktop: full-width two-column layout (matches product details) */}
        <div className="hidden gap-4 lg:grid lg:grid-cols-2 lg:items-start">
          <SupplierDetailsContent supplier={supplier} />
          <SupplierPurchasesContent
            purchases={purchases}
            purchaseSummary={purchaseSummary}
          />
        </div>
      </div>

      <SupplierFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        supplier={supplier}
        onSuccess={() => router.refresh()}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Supplier?"
        description="Are you sure you want to delete this supplier?"
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
