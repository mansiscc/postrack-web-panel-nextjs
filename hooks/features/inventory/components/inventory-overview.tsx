"use client";

import {
  AlertTriangle,
  ChevronRight,
  EyeOff,
  Package,
  PackageX,
} from "lucide-react";
import Link from "next/link";
import { useEffect, type ElementType } from "react";

import type {
  InventoryOverview,
  InventoryProductLine,
} from "@/services/inventory.service";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/currency";

type InventoryOverviewProps = {
  overview: InventoryOverview;
  initialFocus?: "low_stock" | "out_of_stock" | "inactive" | null;
};

function formatStockQuantity(quantity: number, unit: string | null) {
  const formatted = formatNumber(quantity);
  return unit?.trim() ? `${formatted} ${unit.trim()}` : formatted;
}

export function InventoryOverviewPanel({
  overview,
  initialFocus = null,
}: InventoryOverviewProps) {
  useEffect(() => {
    if (!initialFocus) return;
    const id =
      initialFocus === "low_stock"
        ? "inventory-low-stock"
        : initialFocus === "out_of_stock"
          ? "inventory-out-of-stock"
          : "inventory-inactive";
    const node = document.getElementById(id);
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initialFocus]);

  const healthPercent =
    overview.activeProducts <= 0
      ? 0
      : Math.round((overview.inStockCount / overview.activeProducts) * 100);
  const inStockRatio =
    overview.activeProducts <= 0
      ? 0
      : overview.inStockCount / overview.activeProducts;

  return (
    <div className="space-y-4 lg:space-y-5">
      <InventoryHealthHeader
        totalProducts={overview.totalProducts}
        activeProducts={overview.activeProducts}
        healthPercent={healthPercent}
        inStockRatio={inStockRatio}
        chips={[
          {
            label: "In Stock",
            value: overview.inStockCount,
            dotClass: "bg-success",
            href: "/products?stock=in_stock",
          },
          {
            label: "Low Stock",
            value: overview.lowStockCount,
            dotClass: "bg-warning",
            href: "/inventory?stock=low_stock",
          },
          {
            label: "Out of stock",
            value: overview.outOfStockCount,
            dotClass: "bg-destructive",
            href: "/inventory?stock=out_of_stock",
          },
          {
            label: "Inactive",
            value: overview.inactiveProducts,
            dotClass: "bg-muted-foreground",
            href: "/inventory?stock=inactive",
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <ProductAlertSection
          id="inventory-low-stock"
          title="Low Stock"
          subtitle="At or below alert threshold"
          icon={AlertTriangle}
          accent="text-warning-icon"
          badgeBg="bg-warning-muted"
          accentDot="bg-warning"
          products={overview.lowStockProducts}
          emptyMessage="All products are above the low stock threshold"
          highlighted={initialFocus === "low_stock"}
        />
        <ProductAlertSection
          id="inventory-out-of-stock"
          title="Out of Stock"
          subtitle="Zero or negative stock"
          icon={PackageX}
          accent="text-destructive"
          badgeBg="bg-destructive-muted"
          accentDot="bg-destructive"
          products={overview.outOfStockProducts}
          emptyMessage="No out of stock products"
          highlighted={initialFocus === "out_of_stock"}
        />
        <ProductAlertSection
          id="inventory-inactive"
          title="Inactive"
          subtitle="Products disabled from sale"
          icon={EyeOff}
          accent="text-muted-foreground"
          badgeBg="bg-muted"
          accentDot="bg-muted-foreground"
          products={overview.inactiveProductLines}
          emptyMessage="No inactive products"
          showStockAlert={false}
          highlighted={initialFocus === "inactive"}
        />
      </div>
    </div>
  );
}

function InventoryHealthHeader({
  totalProducts,
  activeProducts,
  healthPercent,
  inStockRatio,
  chips,
}: {
  totalProducts: number;
  activeProducts: number;
  healthPercent: number;
  inStockRatio: number;
  chips: Array<{
    label: string;
    value: number;
    dotClass: string;
    href?: string;
  }>;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/25",
        "bg-linear-to-r from-primary to-primary-hover text-primary-foreground",
        "shadow-[0_12px_28px_-12px_rgba(210,18,46,0.45)]",
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 size-56 rounded-full bg-black/10 blur-3xl" />

      <div className="relative grid gap-5 p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] lg:items-end lg:gap-8 lg:p-6">
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-white/15">
                <Package className="size-4" strokeWidth={2} />
              </span>
              <h2 className="text-base font-bold tracking-tight lg:text-lg">
                Inventory Health
              </h2>
            </div>
            <p className="text-[13px] text-white/75">
              {formatNumber(totalProducts)} products ·{" "}
              {formatNumber(activeProducts)} active
            </p>
          </div>

          <div className="rounded-xl border border-white/25 bg-white/12 px-3.5 py-3 backdrop-blur-[2px]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-[12px] font-medium text-white/85">
                In stock ratio
              </span>
              <span className="text-base font-bold tabular-nums">
                {healthPercent}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-500"
                style={{
                  width: `${Math.max(0, Math.min(100, inStockRatio * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-2.5">
          {chips.map((chip) => {
            const content = (
              <>
                <p className="text-lg font-bold tabular-nums lg:text-xl">
                  {formatNumber(chip.value)}
                </p>
                <div className="mt-1.5 flex items-center justify-center gap-1.5">
                  <span
                    className={cn("size-1.5 shrink-0 rounded-full", chip.dotClass)}
                  />
                  <span className="truncate text-[11px] font-medium text-white/85">
                    {chip.label}
                  </span>
                </div>
              </>
            );

            return chip.href ? (
              <Link
                key={chip.label}
                href={chip.href}
                className="rounded-xl border border-white/20 bg-white/12 px-2.5 py-3 text-center backdrop-blur-[2px] transition-colors hover:bg-white/20"
              >
                {content}
              </Link>
            ) : (
              <div
                key={chip.label}
                className="rounded-xl border border-white/20 bg-white/12 px-2.5 py-3 text-center backdrop-blur-[2px]"
              >
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProductAlertSection({
  id,
  title,
  subtitle,
  icon: Icon,
  accent,
  badgeBg,
  accentDot,
  products,
  emptyMessage,
  showStockAlert = true,
  highlighted = false,
}: {
  id: string;
  title: string;
  subtitle: string;
  icon: ElementType;
  accent: string;
  badgeBg: string;
  accentDot: string;
  products: InventoryProductLine[];
  emptyMessage: string;
  showStockAlert?: boolean;
  highlighted?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "flex min-h-0 scroll-mt-20 flex-col overflow-hidden rounded-lg bg-card shadow-card",
        highlighted && "ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-start gap-2.5 border-b border-border/40 px-3.5 py-3">
        <span
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
            badgeBg,
          )}
        >
          <Icon className={cn("size-4", accent)} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[13px] font-bold text-foreground">
              {title}
            </h3>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                badgeBg,
                accent,
              )}
            >
              {products.length}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-1 items-center px-3.5 py-6">
          <p className="text-[13px] text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <ul className="max-h-112 divide-y divide-border/50 overflow-y-auto lg:max-h-[min(36rem,calc(100dvh-22rem))]">
          {products.map((product) => (
            <InventoryProductRow
              key={product.id}
              product={product}
              accent={accent}
              accentDot={accentDot}
              showStockAlert={showStockAlert}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function InventoryProductRow({
  product,
  accent,
  accentDot,
  showStockAlert,
}: {
  product: InventoryProductLine;
  accent: string;
  accentDot: string;
  showStockAlert: boolean;
}) {
  const stockLabel = formatStockQuantity(product.stockQuantity, product.unit);
  const meta = [
    product.categoryName?.trim() || null,
    showStockAlert && product.lowStockAlertQty > 0
      ? `Alert ${formatStockQuantity(product.lowStockAlertQty, product.unit)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <Link
        href={`/products/${product.id}`}
        className="flex items-center gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-primary-muted/40"
      >
        <span className={cn("size-1.5 shrink-0 rounded-full", accentDot)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">
            {product.name}
          </p>
          {meta ? (
            <p className="truncate text-[11px] text-muted-foreground">{meta}</p>
          ) : null}
        </div>
        <span className={cn("shrink-0 text-[13px] font-bold tabular-nums", accent)}>
          {stockLabel}
        </span>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
      </Link>
    </li>
  );
}
