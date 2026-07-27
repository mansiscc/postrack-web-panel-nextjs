"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage?: string;
  className?: string;
  onRowClick?: (row: TData) => void;
  enableRowSelection?: boolean;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = "No results found.",
  className,
  onRowClick,
  enableRowSelection = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection },
    enableRowSelection,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div
      className={cn(
        // Border on the outer node; clip on the inner so overflow doesn't
        // shave anti-aliased corner pixels off the stroke.
        "rounded-xl border border-border bg-card",
        className,
      )}
    >
      <div className="overflow-hidden rounded-[inherit]">
        <Table>
          <TableHeader className="bg-muted/60">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-10 px-3.5 text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    "h-10 transition-colors duration-150",
                    onRowClick && "cursor-pointer",
                  )}
                  onClick={(event) => {
                    if (!onRowClick) return;
                    const target = event.target as HTMLElement;
                    if (
                      target.closest(
                        "[data-row-action], button, a, input, label, [role='checkbox'], [role='switch'], [role='combobox']",
                      )
                    ) {
                      return;
                    }
                    onRowClick(row.original);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="px-3.5 py-2.5 text-[13px] leading-snug"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-36 border-b-0 text-center text-[13px] text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
