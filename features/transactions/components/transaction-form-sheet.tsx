"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createTransactionAction,
  updateTransactionAction,
} from "@/features/transactions/actions";
import {
  transactionSchema,
  type TransactionFormInput,
} from "@/features/transactions/schema";
import type { TransactionListItem } from "@/features/transactions/types";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type FormOption = { id: string; name: string };

type TransactionFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: TransactionListItem | null;
  accounts: FormOption[];
  incomeCategories: FormOption[];
  expenseCategories: FormOption[];
  onSuccess: () => void;
};

export function TransactionFormSheet({
  open,
  onOpenChange,
  transaction,
  accounts,
  incomeCategories,
  expenseCategories,
  onSuccess,
}: TransactionFormSheetProps) {
  const isEdit = Boolean(transaction);
  const form = useForm<TransactionFormInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      entryType: "income",
      accountId: "",
      categoryId: "",
      amount: 0,
      entryDate: new Date().toISOString().slice(0, 10),
      remarks: "",
      paymentMode: "Cash",
    },
  });

  const entryType = form.watch("entryType");
  const categories = useMemo(
    () => (entryType === "income" ? incomeCategories : expenseCategories),
    [entryType, incomeCategories, expenseCategories],
  );

  useEffect(() => {
    if (open) {
      form.reset({
        entryType: transaction?.entryType ?? "income",
        accountId: transaction?.accountId ?? accounts[0]?.id ?? "",
        categoryId: transaction?.categoryId ?? "",
        amount: transaction?.amount ?? 0,
        entryDate:
          transaction?.entryDate ?? new Date().toISOString().slice(0, 10),
        remarks: transaction?.remarks ?? "",
        paymentMode: transaction?.paymentMode ?? "Cash",
      });
    }
  }, [open, transaction, accounts, form]);

  useEffect(() => {
    const currentCategoryId = form.getValues("categoryId");
    if (
      currentCategoryId &&
      !categories.some((category) => category.id === currentCategoryId)
    ) {
      form.setValue("categoryId", categories[0]?.id ?? "");
    }
  }, [categories, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const result = isEdit
      ? await updateTransactionAction(transaction!.id, values)
      : await createTransactionAction(values);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Entry updated" : "Entry created");
    onOpenChange(false);
    onSuccess();
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-120">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Edit manual entry" : "Add manual entry"}
          </SheetTitle>
        </SheetHeader>
        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-2">
            <FormField
              label="Type"
              required
              error={form.formState.errors.entryType?.message}
            >
              <Select
                value={form.watch("entryType")}
                onValueChange={(value: "income" | "expense") =>
                  form.setValue("entryType", value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label="Account"
              required
              error={form.formState.errors.accountId?.message}
            >
              <Select
                value={form.watch("accountId")}
                onValueChange={(value) => form.setValue("accountId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label="Category"
              required
              error={form.formState.errors.categoryId?.message}
            >
              <Select
                value={form.watch("categoryId")}
                onValueChange={(value) => form.setValue("categoryId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label="Amount"
              htmlFor="amount"
              required
              error={form.formState.errors.amount?.message}
            >
              <Input
                id="amount"
                type="number"
                min={0.01}
                step="0.01"
                {...form.register("amount")}
              />
            </FormField>
            <FormField
              label="Date"
              htmlFor="entryDate"
              required
              error={form.formState.errors.entryDate?.message}
            >
              <Input id="entryDate" type="date" {...form.register("entryDate")} />
            </FormField>
            <FormField
              label="Payment mode"
              error={form.formState.errors.paymentMode?.message}
            >
              <Select
                value={form.watch("paymentMode") ?? "Cash"}
                onValueChange={(value: "Cash" | "UPI" | "Card" | "Mixed") =>
                  form.setValue("paymentMode", value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Card">Card</SelectItem>
                  <SelectItem value="Mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label="Remarks"
              htmlFor="remarks"
              error={form.formState.errors.remarks?.message}
            >
              <Textarea id="remarks" rows={3} {...form.register("remarks")} />
            </FormField>
          </div>
          <SheetFooter className="border-t px-4 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
