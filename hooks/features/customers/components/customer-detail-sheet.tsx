"use client";

import { Loader2, Mail, MapPin, Pencil, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
      cell: ({ row }) => (
        <span className="font-medium text-primary">
          {row.original.bill_number ?? "—"}
        </span>
      ),
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
      <ModalCardContent size="2xl">
        <ModalCardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <ModalCardTitle>{customer?.name}</ModalCardTitle>
              <p className="text-sm text-muted-foreground">
                {customer?.phone || "No phone"}
              </p>
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
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-card">
                <div className="space-y-3 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-[17px] font-bold leading-snug tracking-tight">
                        {customer?.name}
                      </p>
                      <p className="inline-flex items-center gap-1.5 text-[13px] font-medium">
                        <Phone className="size-3.5 shrink-0" strokeWidth={2.2} />
                        {customer?.phone || "No phone"}
                      </p>
                    </div>
                    <span className="shrink-0">
                      <StatusBadge
                        status={customer?.isActive ? "active" : "inactive"}
                        label={customer?.isActive ? "Active" : "Inactive"}
                      />
                    </span>
                  </div>
                  <div className="h-px bg-white/25" />
                  <div className="grid gap-2 text-[13px]">
                    <p className="inline-flex items-start gap-1.5">
                      <Mail className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.2} />
                      <span>{customer?.email || "No email provided"}</span>
                    </p>
                    <p className="inline-flex items-start gap-1.5">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.2} />
                      <span>{customer?.address || "No address provided"}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-card p-4 shadow-card">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Billing Summary
                </h3>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="rounded-md bg-surface-variant px-3 py-2.5">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Total Bills
                    </p>
                    <p className="mt-1 text-[14px] font-bold tabular-nums text-foreground">
                      {bills.length}
                    </p>
                  </div>
                  <div className="rounded-md bg-surface-variant px-3 py-2.5">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Latest Bill
                    </p>
                    <p className="mt-1 text-[14px] font-bold text-foreground">
                      {bills[0]?.bill_number || "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                Bill History
              </h3>
              {isPending ? (
                <div className="flex justify-center rounded-lg bg-card py-8 shadow-card">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : bills.length === 0 ? (
                <p className="rounded-lg bg-card px-4 py-8 text-sm text-muted-foreground shadow-card">
                  No bills recorded for this customer yet.
                </p>
              ) : (
                <div className="rounded-lg bg-card p-2 shadow-card sm:p-3">
                  <DataTable
                    columns={columns}
                    data={bills}
                    onRowClick={(row) => {
                      onOpenChange(false);
                      router.push(`/sales/${row.id}`);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </ModalCardBody>
      </ModalCardContent>
    </ModalCard>
  );
}
