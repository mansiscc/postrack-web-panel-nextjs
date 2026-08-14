"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Package, Plus } from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

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
import { DataTablePagination } from "@/components/data-table/pagination";
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
import { buildQueryString } from "@/utils/url-query";

type CategoryOption = { id: string; name: string };

type ProductFilters = {
  search: string;
  categoryId: string;
  stock: "all" | "in_stock" | "low_stock" | "out_of_stock";
  status: "all" | "active" | "inactive" | "deleted";
};

type ProductTableProps = {
  products: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  categories: CategoryOption[];
  canDelete: boolean;
  filters: ProductFilters;
};

export function ProductTable({
  products,
  total,
  page,
  pageSize,
  categories,
  canDelete,
  filters,
}: ProductTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const refresh = useTableRefresh();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductListItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const pushFilters = (
    patch: Partial<ProductFilters & { page: number; pageSize: number }>,
  ) => {
    const next = {
      q: patch.search ?? filters.search,
      category: patch.categoryId ?? filters.categoryId,
      stock: patch.stock ?? filters.stock,
      status: patch.status ?? filters.status,
      page: patch.page ?? page,
      pageSize: patch.pageSize ?? pageSize,
    };
    if (
      patch.search !== undefined ||
      patch.categoryId !== undefined ||
      patch.stock !== undefined ||
      patch.status !== undefined
    ) {
      next.page = 1;
    }
    startTransition(() => {
      router.push(`${pathname}${buildQueryString(next)}`);
    });
  };

  const handleToggle = (item: ProductListItem, isActive: boolean) => {
    startTransition(async () => {
      const result = await toggleProductActiveAction(item.id, isActive);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      refresh();
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
      toast.success("Product deleted");
      setDeleteTarget(null);
      refresh();
    });
  };

  const handleRestore = (item: ProductListItem) => {
    startTransition(async () => {
      const result = await restoreProductAction(item.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Product restored");
      refresh();
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
          value={filters.search}
          onChange={(value) => pushFilters({ search: value })}
          placeholder="Search name or barcode…"
        />
        <Select
          value={filters.categoryId}
          onValueChange={(value) => pushFilters({ categoryId: value })}
        >
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
          value={filters.stock}
          onValueChange={(value) =>
            pushFilters({ stock: value as ProductFilters["stock"] })
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
          value={filters.status}
          onValueChange={(value) =>
            pushFilters({ status: value as ProductFilters["status"] })
          }
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

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products found"
          description={
            filters.search ||
            filters.categoryId !== "all" ||
            filters.stock !== "all" ||
            filters.status !== "all"
              ? "No products match your current search or filters."
              : "Add your first product to start selling and tracking stock."
          }
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
        <div className={isPending ? "opacity-60 transition-opacity" : undefined}>
          <DataTable
            columns={columns}
            data={products}
            onRowClick={(product) => {
              router.push(`/products/${product.id}`);
            }}
          />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(nextPage) => pushFilters({ page: nextPage })}
            onPageSizeChange={(nextSize) =>
              pushFilters({ pageSize: nextSize, page: 1 })
            }
          />
        </div>
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
