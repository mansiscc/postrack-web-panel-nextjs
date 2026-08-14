"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  Landmark,
  Minus,
  Pencil,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { toggleAccountActiveAction } from "@/hooks/features/accounts/actions";
import { AccountFormSheet } from "@/hooks/features/accounts/components/account-form-sheet";
import type { AccountListItem } from "@/hooks/features/accounts/types";
import {
  getSourceTypeLabel,
  type TransactionListItem,
} from "@/hooks/features/transactions/types";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTablePagination } from "@/components/data-table/pagination";
import { EmptyState } from "@/components/feedback/empty-state";
import { ActiveStatusToggle } from "@/components/forms/status-badge";
import { useTopbarChrome } from "@/components/layout/topbar-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/currency";
import { formatDate } from "@/utils/date";
import { buildQueryString } from "@/utils/url-query";

type AccountDetailsViewProps = {
  account: AccountListItem;
  entries: TransactionListItem[];
  total: number;
  page: number;
  pageSize: number;
  canManage: boolean;
};

type MetricCardProps = {
  label: string;
  value: string;
  valueClassName?: string;
  cardClassName: string;
  borderClassName: string;
  icon?: React.ReactNode;
};

function MetricCard({
  label,
  value,
  valueClassName,
  cardClassName,
  borderClassName,
  icon,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3 shadow-card-sm",
        cardClassName,
        borderClassName,
      )}
    >
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
        {icon}
        <p
          className={cn(
            "truncate text-[15px] font-semibold tabular-nums text-foreground",
            valueClassName,
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

export function AccountDetailsView({
  account,
  entries,
  total,
  page,
  pageSize,
  canManage,
}: AccountDetailsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { setChrome, clearChrome } = useTopbarChrome();
  const [formOpen, setFormOpen] = useState(false);
  const [isActive, setIsActive] = useState(account.isActive);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setIsActive(account.isActive);
  }, [account.isActive]);

  const pushLedgerPage = (nextPage: number, nextPageSize = pageSize) => {
    startTransition(() => {
      router.push(
        `${pathname}${buildQueryString({ page: nextPage, pageSize: nextPageSize })}`,
      );
    });
  };

  const inflows = useMemo(
    () =>
      entries
        .filter((entry) => entry.entryType === "income")
        .reduce((sum, entry) => sum + entry.amount, 0),
    [entries],
  );

  const outflows = useMemo(
    () =>
      entries
        .filter((entry) => entry.entryType !== "income")
        .reduce((sum, entry) => sum + entry.amount, 0),
    [entries],
  );

  const balanceDelta = account.currentBalance - account.openingBalance;

  const handleToggle = (nextActive: boolean) => {
    if (!canManage) return;
    startTransition(async () => {
      const result = await toggleAccountActiveAction(account.id, nextActive);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setIsActive(nextActive);
      router.refresh();
    });
  };

  useEffect(() => {
    setChrome({
      title: account.name || "Account Details",
      actions: (
        <div className="flex items-center gap-2">
          <ActiveStatusToggle
            isActive={isActive}
            disabled={!canManage}
            onToggle={handleToggle}
          />
          {account.isDefault ? <Badge variant="secondary">Default</Badge> : null}
          {canManage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFormOpen(true)}
            >
              <Pencil />
              Edit
            </Button>
          ) : null}
        </div>
      ),
    });

    return () => clearChrome();
  }, [
    account.name,
    account.isDefault,
    isActive,
    canManage,
    setChrome,
    clearChrome,
  ]);

  const columns = useMemo<ColumnDef<TransactionListItem>[]>(
    () => [
      {
        accessorKey: "entryDate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => formatDate(row.original.entryDate),
      },
      {
        accessorKey: "entryType",
        header: "Type",
        cell: ({ row }) => (
          <span
            className={cn(
              "capitalize font-medium",
              row.original.entryType === "income"
                ? "text-success"
                : "text-destructive",
            )}
          >
            {row.original.entryType}
          </span>
        ),
      },
      {
        accessorKey: "categoryName",
        header: "Category",
      },
      {
        accessorKey: "sourceType",
        header: "Source",
        cell: ({ row }) => getSourceTypeLabel(row.original.sourceType),
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Amount" />
        ),
        cell: ({ row }) => (
          <p
            className={cn(
              "tabular-nums font-semibold",
              row.original.entryType === "expense"
                ? "text-destructive"
                : "text-success",
            )}
          >
            {row.original.entryType === "expense" ? "−" : "+"}
            {formatCurrency(row.original.amount)}
          </p>
        ),
      },
      {
        accessorKey: "remarks",
        header: "Remarks",
        cell: ({ row }) => (
          <span className="block max-w-48 truncate text-muted-foreground">
            {row.original.remarks || "—"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <div className="w-full space-y-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            label="Opening"
            value={formatCurrency(account.openingBalance)}
            cardClassName="bg-[linear-gradient(180deg,#E0F2FE_0%,#FFFFFF_100%)]"
            borderClassName="border-[#0369A1]/20"
          />
          <MetricCard
            label="Current"
            value={formatCurrency(account.currentBalance)}
            valueClassName={
              account.currentBalance > 0
                ? "text-success"
                : account.currentBalance < 0
                  ? "text-destructive"
                  : "text-muted-foreground"
            }
            cardClassName="bg-[linear-gradient(180deg,#D1FAE5_0%,#FFFFFF_100%)]"
            borderClassName="border-[#059669]/25"
          />
          <MetricCard
            label="Balance Trend"
            value={
              balanceDelta === 0
                ? "—"
                : formatCurrency(Math.abs(balanceDelta))
            }
            valueClassName={
              balanceDelta > 0
                ? "text-success"
                : balanceDelta < 0
                  ? "text-destructive"
                  : "text-muted-foreground"
            }
            icon={
              balanceDelta > 0 ? (
                <TrendingUp className="size-4 shrink-0 text-success" />
              ) : balanceDelta < 0 ? (
                <TrendingDown className="size-4 shrink-0 text-destructive" />
              ) : (
                <Minus className="size-4 shrink-0 text-muted-foreground" />
              )
            }
            cardClassName="bg-[linear-gradient(180deg,#FEF3C7_0%,#FFFFFF_100%)]"
            borderClassName="border-[#D97706]/25"
          />
          <MetricCard
            label="Transactions"
            value={String(total)}
            cardClassName="bg-[linear-gradient(180deg,#EDE9FE_0%,#FFFFFF_100%)]"
            borderClassName="border-[#7C3AED]/20"
          />
          <MetricCard
            label="Total Inflows"
            value={formatCurrency(inflows)}
            valueClassName="text-[#0D9488]"
            cardClassName="bg-[linear-gradient(180deg,#CCFBF1_0%,#FFFFFF_100%)]"
            borderClassName="border-[#0D9488]/25"
          />
          <MetricCard
            label="Total Outflows"
            value={formatCurrency(outflows)}
            valueClassName="text-destructive"
            cardClassName="bg-[linear-gradient(180deg,#FEE2E2_0%,#FFFFFF_100%)]"
            borderClassName="border-[#DC2626]/20"
          />
        </div>

        <div className="space-y-2.5">
          <div className="flex items-end justify-between gap-3">
            <h3 className="text-[14px] font-semibold text-foreground">
              Recent Activity
            </h3>
            <p className="text-[12px] text-muted-foreground">
              {total === 0
                ? "No transactions recorded"
                : `${total} transaction${total === 1 ? "" : "s"}`}
            </p>
          </div>

          {entries.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="No transactions yet"
              description="Entries for this account will appear here."
            />
          ) : (
            <div
              className={isPending ? "opacity-60 transition-opacity" : undefined}
            >
              <div className="rounded-lg border border-border/60 bg-card shadow-card-sm">
                <DataTable columns={columns} data={entries} />
              </div>
              <DataTablePagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={(nextPage) => pushLedgerPage(nextPage)}
                onPageSizeChange={(nextSize) => pushLedgerPage(1, nextSize)}
              />
            </div>
          )}
        </div>
      </div>

      <AccountFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        account={{ ...account, isActive }}
        onSuccess={() => {
          setFormOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
