"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Package } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  getStockStatus,
  mapProductRow,
  type ProductListItem,
} from "@/features/products/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/feedback/empty-state";
import { SearchInput } from "@/components/forms/search-input";
import { StatusBadge } from "@/components/forms/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { InventoryOverview } from "@/services/inventory.service";
import type { ProductListRow } from "@/repositories/products.repository";
import { formatCurrency, formatNumber } from "@/utils/currency";

type InventoryOverviewProps = {
  overview: InventoryOverview;
  products: ProductListRow[];
};

export function InventoryOverviewPanel({
  overview,
  products,
}: InventoryOverviewProps) {
  const [search, setSearch] = useState("");
  const [stock, setStock] = useState<
    "all" | "in_stock" | "low_stock" | "out_of_stock"
  >("all");

  const items = useMemo(
    () => products.map(mapProductRow),
    [products],
  );

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const term = search.toLowerCase();
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        (item.barcode?.toLowerCase().includes(term) ?? false);
      const stockStatus = getStockStatus(item);
      const matchesStock =
        stock === "all" ||
        (stock === "in_stock" && stockStatus === "ok") ||
        (stock === "low_stock" && stockStatus === "low") ||
        (stock === "out_of_stock" && stockStatus === "out");
      return matchesSearch && matchesStock;
    });
  }, [items, search, stock]);

  const columns = useMemo<ColumnDef<ProductListItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Product" />
        ),
        cell: ({ row }) => (
          <Link
            href="/products"
            className="font-medium hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "categoryName",
        header: "Category",
        cell: ({ row }) => row.original.categoryName ?? "—",
      },
      {
        accessorKey: "stockQuantity",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Qty"
            className="justify-end"
          />
        ),
        cell: ({ row }) => {
          const stockStatus = getStockStatus(row.original);
          return (
            <div
              className={cn(
                "text-right tabular-nums",
                stockStatus === "out" && "text-destructive",
                stockStatus === "low" && "text-amber-600",
              )}
            >
              {formatNumber(row.original.stockQuantity)}
            </div>
          );
        },
      },
      {
        accessorKey: "purchasePrice",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Cost"
            className="justify-end"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {formatCurrency(row.original.purchasePrice)}
          </div>
        ),
      },
      {
        id: "stockValue",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Stock value"
            className="justify-end"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums font-medium">
            {formatCurrency(
              row.original.stockQuantity * (row.original.purchasePrice ?? 0),
            )}
          </div>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.isActive ? "active" : "inactive"}
            label={row.original.isActive ? "Active" : "Inactive"}
          />
        ),
      },
    ],
    [],
  );

  const kpis = [
    { label: "Active products", value: formatNumber(overview.totalProducts) },
    {
      label: "Total stock units",
      value: formatNumber(overview.totalStockUnits),
    },
    {
      label: "Inventory value (cost)",
      value: formatCurrency(overview.totalStockValue),
    },
    { label: "Low stock", value: formatNumber(overview.lowStockCount) },
    { label: "Out of stock", value: formatNumber(overview.outOfStockCount) },
    { label: "Inactive", value: formatNumber(overview.inactiveCount) },
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-[13px] font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <DataTableToolbar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search products…"
          />
          <Select
            value={stock}
            onValueChange={(value) => setStock(value as typeof stock)}
          >
            <SelectTrigger className="h-10 w-36">
              <SelectValue placeholder="Stock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stock</SelectItem>
              <SelectItem value="in_stock">In stock</SelectItem>
              <SelectItem value="low_stock">Low stock</SelectItem>
              <SelectItem value="out_of_stock">Out of stock</SelectItem>
            </SelectContent>
          </Select>
        </DataTableToolbar>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No inventory records"
            description="Add products to start tracking inventory."
          />
        ) : (
          <DataTable columns={columns} data={filtered} />
        )}
      </div>
    </>
  );
}
