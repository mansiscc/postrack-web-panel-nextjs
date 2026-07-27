"use client";

import { Loader2, Package, Pencil } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";

import { getProductDetailsAction } from "@/hooks/features/products/actions";
import {
  mapProductBatch,
  parseProductDetailsPayload,
  type ProductBatchItem,
  type ProductDetailsPayload,
  type ProductListItem,
} from "@/hooks/features/products/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { StatusBadge } from "@/components/forms/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ModalCard,
  ModalCardContent,
  ModalCardHeader,
  ModalCardTitle,
} from "@/components/ui/modal-card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { formatCurrency, formatNumber } from "@/utils/currency";
import { formatDateTime } from "@/utils/date";
import type { ColumnDef } from "@tanstack/react-table";

type ProductDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductListItem | null;
  onEdit: (product: ProductListItem) => void;
};

export function ProductDetailSheet({
  open,
  onOpenChange,
  product,
  onEdit,
}: ProductDetailSheetProps) {
  const [details, setDetails] = useState<ProductDetailsPayload | null>(null);
  const [batches, setBatches] = useState<ProductBatchItem[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !product) {
      setDetails(null);
      setBatches([]);
      return;
    }

    startTransition(async () => {
      const result = await getProductDetailsAction(product.id);
      setDetails(parseProductDetailsPayload(result.details));
      setBatches(result.batches.map(mapProductBatch));
    });
  }, [open, product]);

  const movementColumns: ColumnDef<ProductDetailsPayload["movements"][number]>[] =
    [
      {
        accessorKey: "created_at",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => formatDateTime(row.original.created_at),
      },
      {
        accessorKey: "transaction_type",
        header: "Type",
        cell: ({ row }) => row.original.transaction_type,
      },
      {
        accessorKey: "quantity",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Qty"
          />
        ),
        cell: ({ row }) => {
          const qty = row.original.quantity;
          const prefix = qty >= 0 ? "+" : "";
          return (
            <span
              className={
                qty >= 0 ? "text-emerald-600 tabular-nums" : "text-destructive tabular-nums"
              }
            >
              {prefix}
              {formatNumber(qty)}
            </span>
          );
        },
      },
      {
        accessorKey: "party_name",
        header: "Party",
        cell: ({ row }) => row.original.party_name ?? "—",
      },
      {
        accessorKey: "document_label",
        header: "Reference",
        cell: ({ row }) => row.original.document_label ?? "—",
      },
    ];

  const batchColumns: ColumnDef<ProductBatchItem>[] = [
    {
      accessorKey: "name",
      header: "Batch",
    },
    {
      accessorKey: "quantityRemaining",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Remaining"
          />
      ),
      cell: ({ row }) => (
        <div className="tabular-nums">
          {formatNumber(row.original.quantityRemaining)}
        </div>
      ),
    },
    {
      accessorKey: "purchasePrice",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Purchase"
          />
      ),
      cell: ({ row }) => (
        <div className="tabular-nums">
          {formatCurrency(row.original.purchasePrice)}
        </div>
      ),
    },
    {
      accessorKey: "sellingPrice",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Selling"
          />
      ),
      cell: ({ row }) => (
        <div className="tabular-nums">
          {formatCurrency(row.original.sellingPrice)}
        </div>
      ),
    },
  ];

  return (
    <ModalCard open={open} onOpenChange={onOpenChange}>
      <ModalCardContent size="xl">
        <ModalCardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative size-14 overflow-hidden rounded-lg border border-border bg-muted">
                {product?.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <Package className="size-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div>
                <ModalCardTitle>{product?.name}</ModalCardTitle>
                <p className="text-sm text-muted-foreground">
                  {product?.categoryName ?? "Uncategorized"}
                  {product?.barcode ? ` · ${product.barcode}` : ""}
                </p>
              </div>
            </div>
            {product ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(product);
                }}
              >
                <Pencil />
                Edit
              </Button>
            ) : null}
          </div>
        </ModalCardHeader>

        {isPending ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="overview" className="flex flex-1 flex-col overflow-hidden">
            <TabsList className="mx-4 mt-4 w-fit">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="stock">Stock & Batches</TabsTrigger>
              <TabsTrigger value="movements">Movements</TabsTrigger>
              <TabsTrigger value="financials">Financials</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2">
                  <StatusBadge
                    status={product?.isActive ? "active" : "inactive"}
                    label={product?.isActive ? "Active" : "Inactive"}
                  />
                  {product?.isDeleted ? (
                    <StatusBadge status="inactive" label="Deleted" />
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Purchase</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {formatCurrency(product?.purchasePrice)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Selling</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {formatCurrency(product?.sellingPrice)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">MRP</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {formatCurrency(product?.mrp)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
                <p className="text-sm text-muted-foreground">
                  Unit: {product?.unit || "—"} · Current stock:{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatNumber(product?.stockQuantity)}
                  </span>
                </p>
              </div>
            </TabsContent>

            <TabsContent value="stock" className="flex-1 overflow-y-auto px-4 pb-4">
              {details ? (
                <div className="space-y-4 pt-2">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ["Opening", details.stock_summary.opening_stock],
                      ["Received", details.stock_summary.total_received],
                      ["Sold", details.stock_summary.total_sold],
                      ["Returned", details.stock_summary.total_returned],
                    ].map(([label, value]) => (
                      <Card key={label}>
                        <CardContent className="pt-4">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="text-lg font-semibold tabular-nums">
                            {formatNumber(Number(value))}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <DataTable columns={batchColumns} data={batches} />
                </div>
              ) : null}
            </TabsContent>

            <TabsContent
              value="movements"
              className="flex-1 overflow-y-auto px-4 pb-4"
            >
              {details ? (
                <DataTable
                  columns={movementColumns}
                  data={details.movements.slice(0, 20)}
                />
              ) : null}
            </TabsContent>

            <TabsContent
              value="financials"
              className="flex-1 overflow-y-auto px-4 pb-4"
            >
              {details ? (
                <div className="grid gap-3 pt-2 sm:grid-cols-2">
                  {[
                    ["Net revenue", details.financial_summary.net_revenue],
                    ["COGS", details.financial_summary.cost_of_goods_sold],
                    ["Gross profit", details.financial_summary.gross_profit],
                    [
                      "Margin",
                      details.financial_summary.profit_margin_percent,
                      true,
                    ],
                    [
                      "Inventory (cost)",
                      details.financial_summary.inventory_value_at_cost,
                    ],
                    [
                      "Inventory (sell)",
                      details.financial_summary.inventory_value_at_sell,
                    ],
                  ].map(([label, value, isPercent]) => (
                    <Card key={String(label)}>
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-lg font-semibold tabular-nums">
                          {isPercent
                            ? value == null
                              ? "—"
                              : `${formatNumber(Number(value))}%`
                            : formatCurrency(Number(value))}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        )}
      </ModalCardContent>
    </ModalCard>
  );
}
