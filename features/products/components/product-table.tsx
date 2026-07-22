"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Package, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import Image from "next/image";
import { useMemo, useState, useTransition } from "react";

import { useTableRefresh } from "@/hooks/use-table-refresh";
import { toast } from "sonner";

import {
  deleteProductAction,
  restoreProductAction,
  toggleProductActiveAction,
} from "@/features/products/actions";
import { ProductDetailSheet } from "@/features/products/components/product-detail-sheet";
import { ProductFormSheet } from "@/features/products/components/product-form-sheet";
import {
  getStockStatus,
  type ProductListItem,
} from "@/features/products/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { SearchInput } from "@/components/forms/search-input";
import { StatusBadge } from "@/components/forms/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/utils/currency";

type CategoryOption = { id: string; name: string };

type ProductTableProps = {
  products: ProductListItem[];
  categories: CategoryOption[];
  canDelete: boolean;
};

export function ProductTable({
  products,
  categories,
  canDelete,
}: ProductTableProps) {
  const [items, setItems] = useState(products);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [stock, setStock] = useState<
    "all" | "in_stock" | "low_stock" | "out_of_stock"
  >("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive" | "deleted">(
    "all",
  );
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<ProductListItem | null>(null);
  const [editing, setEditing] = useState<ProductListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductListItem | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const term = search.toLowerCase();
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        (item.barcode?.toLowerCase().includes(term) ?? false);
      const matchesCategory =
        categoryId === "all" || item.categoryId === categoryId;
      const stockStatus = getStockStatus(item);
      const matchesStock =
        stock === "all" ||
        (stock === "in_stock" && stockStatus === "ok") ||
        (stock === "low_stock" && stockStatus === "low") ||
        (stock === "out_of_stock" && stockStatus === "out");
      const matchesStatus =
        status === "all" ||
        (status === "deleted" && item.isDeleted) ||
        (status === "active" && !item.isDeleted && item.isActive) ||
        (status === "inactive" && !item.isDeleted && !item.isActive);
      return matchesSearch && matchesCategory && matchesStock && matchesStatus;
    });
  }, [items, search, categoryId, stock, status]);

  const refresh = useTableRefresh();

  const handleToggle = (item: ProductListItem, isActive: boolean) => {
    startTransition(async () => {
      const result = await toggleProductActiveAction(item.id, isActive);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, isActive } : row)),
      );
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteProductAction(deleteTarget.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setItems((prev) =>
        prev.map((row) =>
          row.id === deleteTarget.id ? { ...row, isDeleted: true } : row,
        ),
      );
      toast.success("Product deleted");
      setDeleteTarget(null);
    });
  };

  const handleRestore = (item: ProductListItem) => {
    startTransition(async () => {
      const result = await restoreProductAction(item.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, isDeleted: false } : row,
        ),
      );
      toast.success("Product restored");
    });
  };

  const columns = useMemo<ColumnDef<ProductListItem>[]>(
    () => [
      {
        accessorKey: "imageUrl",
        header: "",
        cell: ({ row }) => (
          <div className="relative size-10 overflow-hidden rounded-md border bg-muted">
            {row.original.imageUrl ? (
              <Image
                src={row.original.imageUrl}
                alt={row.original.name}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex size-full items-center justify-center">
                <Package className="size-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <button
            type="button"
            className="text-left font-medium hover:underline"
            onClick={() => {
              setSelected(row.original);
              setDetailOpen(true);
            }}
          >
            {row.original.name}
          </button>
        ),
      },
      {
        accessorKey: "categoryName",
        header: "Category",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.categoryName ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "barcode",
        header: "Barcode",
        cell: ({ row }) => row.original.barcode ?? "—",
      },
      {
        accessorKey: "stockQuantity",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Stock"
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
        accessorKey: "sellingPrice",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Price"
            className="justify-end"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {formatCurrency(row.original.sellingPrice)}
          </div>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={
              row.original.isDeleted
                ? "inactive"
                : row.original.isActive
                  ? "active"
                  : "inactive"
            }
            label={
              row.original.isDeleted
                ? "Deleted"
                : row.original.isActive
                  ? "Active"
                  : "Inactive"
            }
          />
        ),
      },
      {
        id: "activeToggle",
        header: "Active",
        cell: ({ row }) => (
          <Switch
            checked={row.original.isActive}
            disabled={row.original.isDeleted}
            onCheckedChange={(checked) => handleToggle(row.original, checked)}
            aria-label={`Toggle ${row.original.name}`}
          />
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setSelected(row.original);
                  setDetailOpen(true);
                }}
              >
                View details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEditing(row.original);
                  setFormOpen(true);
                }}
              >
                <Pencil />
                Edit
              </DropdownMenuItem>
              {canDelete && row.original.isDeleted ? (
                <DropdownMenuItem onClick={() => handleRestore(row.original)}>
                  <RotateCcw />
                  Restore
                </DropdownMenuItem>
              ) : null}
              {canDelete && !row.original.isDeleted ? (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteTarget(row.original)}
                >
                  <Trash2 />
                  Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [canDelete],
  );

  return (
    <>
      <DataTableToolbar
        actions={
          <Button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus />
            Add product
          </Button>
        }
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name or barcode…"
        />
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="h-10 w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={stock}
          onValueChange={(value) =>
            setStock(value as typeof stock)
          }
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
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as typeof status)}
        >
          <SelectTrigger className="h-10 w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="deleted">Deleted</SelectItem>
          </SelectContent>
        </Select>
      </DataTableToolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products found"
          description="Add your first product to start selling and tracking stock."
          action={
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus />
              Add product
            </Button>
          }
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      <ProductFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        categories={categories}
        onSuccess={refresh}
      />

      <ProductDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        product={selected}
        onEdit={(product) => {
          setEditing(product);
          setFormOpen(true);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete product?"
        description={`Soft-delete "${deleteTarget?.name}"? You can restore it later.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
