"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Package, Plus } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { useSyncedState } from "@/hooks/use-synced-state";
import { useTableRefresh } from "@/hooks/use-table-refresh";
import { toast } from "sonner";

import {
  deleteProductAction,
  restoreProductAction,
  toggleProductActiveAction,
} from "@/hooks/features/products/actions";
import { ProductFormSheet } from "@/hooks/features/products/components/product-form-sheet";
import {
  getStockStatus,
  type ProductListItem,
} from "@/hooks/features/products/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { RowActions } from "@/components/data-table/row-actions";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { SearchInput } from "@/components/forms/search-input";
import { StatusBadge, ActiveStatusToggle } from "@/components/forms/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const router = useRouter();
  const refresh = useTableRefresh();
  const [items, setItems] = useSyncedState(products);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [stock, setStock] = useState<
    "all" | "in_stock" | "low_stock" | "out_of_stock"
  >("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive" | "deleted">(
    "all",
  );
  const [formOpen, setFormOpen] = useState(false);
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
          <div className="relative size-10 overflow-hidden rounded-md border border-border bg-muted">
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
          <span className="font-medium">{row.original.name}</span>
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
          />
        ),
        cell: ({ row }) => {
          const stockStatus = getStockStatus(row.original);
          return (
            <div
              className={cn(
                "tabular-nums",
                stockStatus === "out" && "text-destructive",
                stockStatus === "low" && "text-warning",
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
          />
        ),
        cell: ({ row }) => (
          <div className="tabular-nums">
            {formatCurrency(row.original.sellingPrice)}
          </div>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) =>
          row.original.isDeleted ? (
            <StatusBadge status="deleted" label="Deleted" showDot />
          ) : (
            <ActiveStatusToggle
              isActive={row.original.isActive}
              onToggle={(checked) => handleToggle(row.original, checked)}
            />
          ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <RowActions
            onEdit={() => {
              setEditing(row.original);
              setFormOpen(true);
            }}
            editDisabled={row.original.isDeleted}
            onRestore={
              canDelete && row.original.isDeleted
                ? () => handleRestore(row.original)
                : undefined
            }
            onDelete={() => setDeleteTarget(row.original)}
            deleteDisabled={!canDelete || row.original.isDeleted}
          />
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
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(product) => {
            router.push(`/products/${product.id}`);
          }}
        />
      )}

      <ProductFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        categories={categories}
        onSuccess={refresh}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Product?"
        description="This product will be moved to Deleted. You can restore it later from the Deleted filter."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
