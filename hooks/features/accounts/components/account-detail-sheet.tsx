"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { getAccountLedgerAction } from "@/hooks/features/accounts/actions";
import type { AccountListItem } from "@/hooks/features/accounts/types";
import {
  getSourceTypeLabel,
  mapTransactionRow,
  type TransactionListItem,
} from "@/hooks/features/transactions/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ModalCard,
  ModalCardBody,
  ModalCardContent,
  ModalCardHeader,
  ModalCardTitle,
} from "@/components/ui/modal-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/utils/currency";
import { formatDate } from "@/utils/date";
import { cn } from "@/lib/utils";

type AccountDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountListItem | null;
  onEdit: (account: AccountListItem) => void;
};

export function AccountDetailSheet({
  open,
  onOpenChange,
  account,
  onEdit,
}: AccountDetailSheetProps) {
  const [entries, setEntries] = useState<TransactionListItem[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !account) {
      setEntries([]);
      return;
    }

    startTransition(async () => {
      const rows = await getAccountLedgerAction(account.id);
      setEntries(rows.map(mapTransactionRow));
    });
  }, [open, account]);

  return (
    <ModalCard open={open} onOpenChange={onOpenChange}>
      <ModalCardContent size="xl">
        <ModalCardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <ModalCardTitle>{account?.name ?? "Account"}</ModalCardTitle>
              <p className="text-sm text-muted-foreground">
                {account?.description || "No description"}
              </p>
            </div>
            {account ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEdit(account)}
              >
                Edit
              </Button>
            ) : null}
          </div>
        </ModalCardHeader>

        {account ? (
          <ModalCardBody className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <SummaryTile
                label="Opening"
                value={formatCurrency(account.openingBalance)}
              />
              <SummaryTile
                label="Current balance"
                value={formatCurrency(account.currentBalance)}
              />
              <SummaryTile
                label="Entries"
                value={String(account.entryCount)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {account.isDefault ? <Badge variant="secondary">Default</Badge> : null}
              <Badge variant={account.isActive ? "secondary" : "outline"}>
                {account.isActive ? "Active" : "Inactive"}
              </Badge>
              <Button asChild variant="link" size="sm" className="h-auto px-0">
                <Link href={`/transactions?account=${account.id}`}>
                  Open in transactions
                </Link>
              </Button>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">Recent ledger</h3>
              {isPending ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : entries.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No transactions for this account yet.
                </p>
              ) : (
                <div className="rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{formatDate(entry.entryDate)}</TableCell>
                          <TableCell className="capitalize">
                            {entry.entryType}
                          </TableCell>
                          <TableCell>{entry.categoryName}</TableCell>
                          <TableCell>
                            {getSourceTypeLabel(entry.sourceType)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right tabular-nums font-medium",
                              entry.entryType === "expense" &&
                                "text-destructive",
                            )}
                          >
                            {entry.entryType === "expense" ? "−" : "+"}
                            {formatCurrency(entry.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </ModalCardBody>
        ) : null}
      </ModalCardContent>
    </ModalCard>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <p className="text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}
