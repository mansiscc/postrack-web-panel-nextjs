"use client";

import { Loader2, Pencil } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { getCustomerDetailsAction } from "@/hooks/features/customers/actions";
import type { CustomerListItem } from "@/hooks/features/customers/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { StatusBadge } from "@/components/forms/status-badge";
import { Button } from "@/components/ui/button";
import {
  ModalCard,
  ModalCardBody,
  ModalCardContent,
  ModalCardHeader,
  ModalCardTitle,
} from "@/components/ui/modal-card";
import { formatCurrency } from "@/utils/currency";
import { formatDateTime } from "@/utils/date";
import type { ColumnDef } from "@tanstack/react-table";

type CustomerBill = {
  id: string;
  bill_number: string | null;
  total_payable_amount: number;
  payment_mode: string;
  status: string;
  created_at: string;
};

type CustomerDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CustomerListItem | null;
  onEdit: (customer: CustomerListItem) => void;
};

export function CustomerDetailSheet({
  open,
  onOpenChange,
  customer,
  onEdit,
}: CustomerDetailSheetProps) {
  const [bills, setBills] = useState<CustomerBill[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !customer) {
      setBills([]);
      return;
    }

    startTransition(async () => {
      const result = await getCustomerDetailsAction(customer.id);
      setBills((result.bills ?? []) as CustomerBill[]);
    });
  }, [open, customer]);

  const columns: ColumnDef<CustomerBill>[] = [
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ row }) => formatDateTime(row.original.created_at),
    },
    {
      accessorKey: "bill_number",
      header: "Bill #",
      cell: ({ row }) => row.original.bill_number ?? "—",
    },
    {
      accessorKey: "total_payable_amount",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Amount"
          />
      ),
      cell: ({ row }) => (
        <div className="tabular-nums">
          {formatCurrency(row.original.total_payable_amount)}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge status="active" label={row.original.status} />
      ),
    },
  ];

  return (
    <ModalCard open={open} onOpenChange={onOpenChange}>
      <ModalCardContent size="xl">
        <ModalCardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <ModalCardTitle>{customer?.name}</ModalCardTitle>
              <p className="text-sm text-muted-foreground">{customer?.phone}</p>
            </div>
            {customer ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(customer);
                }}
              >
                <Pencil />
                Edit
              </Button>
            ) : null}
          </div>
        </ModalCardHeader>

        <ModalCardBody className="space-y-4">
          <div className="grid gap-2 text-sm">
            <p>
              <span className="text-muted-foreground">Email:</span>{" "}
              {customer?.email || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Address:</span>{" "}
              {customer?.address || "—"}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Bill history</h3>
            {isPending ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : bills.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No bills recorded for this customer yet.
              </p>
            ) : (
              <DataTable columns={columns} data={bills} />
            )}
          </div>
        </ModalCardBody>
      </ModalCardContent>
    </ModalCard>
  );
}
