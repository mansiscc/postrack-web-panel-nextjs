"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createTransactionAction,
  updateTransactionAction,
} from "@/hooks/features/transactions/actions";
import {
  transactionSchema,
  type TransactionFormInput,
} from "@/hooks/features/transactions/schema";
import type { TransactionListItem } from "@/hooks/features/transactions/types";
import { FormField } from "@/components/forms/form-field";
import { CategoryTypeSelector } from "@/components/forms/category-type-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { bindDecimalInput } from "@/lib/validation/rhf";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ModalCard,
  ModalCardBody,
  ModalCardContent,
  ModalCardFooter,
  ModalCardHeader,
  ModalCardTitle,
} from "@/components/ui/modal-card";

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
    <ModalCard open={open} onOpenChange={onOpenChange}>
      <ModalCardContent size="lg">
        <ModalCardHeader>
          <ModalCardTitle>
            {isEdit ? "Update Entry" : "Add New Entry"}
          </ModalCardTitle>
        </ModalCardHeader>
        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <ModalCardBody className="space-y-5">
            <FormField
              label="Entry Type"
              required
              error={form.formState.errors.entryType?.message}
            >
              <CategoryTypeSelector
                value={form.watch("entryType")}
                onChange={(value) =>
                  form.setValue("entryType", value)
                }
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Payment Account"
                required
                error={form.formState.errors.accountId?.message}
              >
                <Select
                  value={form.watch("accountId")}
                  onValueChange={(value) => form.setValue("accountId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment account" />
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
                label={entryType === "income" ? "Income Category" : "Expense Category"}
                required
                error={form.formState.errors.categoryId?.message}
              >
                <Select
                  value={form.watch("categoryId")}
                  onValueChange={(value) => form.setValue("categoryId", value)}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        entryType === "income"
                          ? "Select income category"
                          : "Select expense category"
                      }
                    />
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
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Entry Date"
                htmlFor="entryDate"
                required
                error={form.formState.errors.entryDate?.message}
              >
                <Input id="entryDate" type="date" {...form.register("entryDate")} />
              </FormField>
              <FormField
                label="Payment Mode"
                error={form.formState.errors.paymentMode?.message}
              >
                <Select
                  value={form.watch("paymentMode") ?? "Cash"}
                  onValueChange={(value: "Cash" | "UPI" | "Card" | "Mixed") =>
                    form.setValue("paymentMode", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                    <SelectItem value="Mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField
              label="Amount"
              htmlFor="amount"
              required
              error={form.formState.errors.amount?.message}
            >
              <Input
                id="amount"
                {...bindDecimalInput(form, "amount", {
                  placeholder: "Enter amount",
                })}
              />
            </FormField>
            <FormField
              label="Remarks"
              htmlFor="remarks"
              error={form.formState.errors.remarks?.message}
            >
              <Textarea
                id="remarks"
                rows={3}
                placeholder="Add notes for this entry (optional)"
                {...form.register("remarks")}
              />
            </FormField>
          </ModalCardBody>
          <ModalCardFooter>
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
                isEdit ? "Update Entry" : "Save Entry"
              )}
            </Button>
          </ModalCardFooter>
        </form>
      </ModalCardContent>
    </ModalCard>
  );
}
