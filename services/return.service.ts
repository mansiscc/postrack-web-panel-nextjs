import { headers } from "next/headers";

import { logActivity } from "@/lib/activity-log";
import {
  createBillEntry,
  createBillReturn,
  createBillReturnItems,
  existsEntryForSource,
  getBillById,
  getBillItems,
  getReturnedQuantitiesByBillItem,
  getSalesReturnCategoryId,
  getTotalRefundedForBillReturnIds,
  listBillReturns,
  updateBillReturnRefundStatus,
  updateBillStatus,
} from "@/repositories/bills.repository";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/types/auth";
import { calculateRefundPayableNow } from "@/utils/billing-calculator";
import { AppError } from "@/utils/errors";

type ReturnInput = {
  billId: string;
  refundMethod: "Cash" | "UPI" | "Card" | "Mixed";
  refundAccountId: string;
  returnNote?: string | null;
  items: Array<{
    billItemId: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
};

export async function processBillReturn(user: SessionUser, input: ReturnInput) {
  if (!input.refundAccountId) {
    throw new AppError(
      "Please select a refund account before saving the return.",
      "VALIDATION_ERROR",
    );
  }

  if (!input.items.length) {
    throw new AppError("Select at least one item to return", "VALIDATION_ERROR");
  }

  const supabase = await createClient();
  const [bill, billItems, returnedMap, previousReturns] = await Promise.all([
    getBillById(supabase, input.billId),
    getBillItems(supabase, input.billId),
    getReturnedQuantitiesByBillItem(supabase, input.billId),
    listBillReturns(supabase, input.billId),
  ]);

  if (!bill) {
    throw new AppError("Bill not found", "NOT_FOUND", 404);
  }

  for (const item of input.items) {
    const sold = billItems.find((row) => row.id === item.billItemId);
    if (!sold) {
      throw new AppError("Bill item not found", "NOT_FOUND", 404);
    }
    const alreadyReturned = returnedMap.get(item.billItemId) ?? 0;
    const returnable = sold.quantity - alreadyReturned;
    if (item.quantity > returnable) {
      throw new AppError(
        `Return quantity exceeds available for ${item.productName}`,
        "VALIDATION_ERROR",
      );
    }
  }

  const totalReturnAmount = Number(
    input.items
      .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
      .toFixed(2),
  );

  const previousReturnedAmount = Number(
    previousReturns
      .reduce((sum, row) => sum + (row.total_return_amount ?? 0), 0)
      .toFixed(2),
  );

  const alreadyRefunded = await getTotalRefundedForBillReturnIds(
    supabase,
    previousReturns.map((row) => row.id),
  );

  const refundPayableNow = calculateRefundPayableNow({
    totalPayable: bill.total_payable_amount,
    receivedAmount: bill.received_amount_total,
    previousReturnedAmount,
    thisReturnAmount: totalReturnAmount,
    alreadyRefunded,
  });

  // Resolve refund category before writing the return so we don't leave a
  // stock/return row without its accounting entry (Android posts entry after
  // return, but fails the whole use-case if category is missing).
  let salesReturnCategoryId: string | null = null;
  if (refundPayableNow > 0) {
    salesReturnCategoryId = await getSalesReturnCategoryId(
      supabase,
      user.companyId,
      { ensure: true, userId: user.id },
    );
    if (!salesReturnCategoryId) {
      throw new AppError(
        "Accounting category 'Sales Return' (expense) not found. Add it under Account Categories as type Expense.",
        "NOT_FOUND",
      );
    }
  }

  const billReturn = await createBillReturn(supabase, {
    company_id: user.companyId,
    bill_id: input.billId,
    return_number: "",
    return_note: input.returnNote ?? null,
    total_return_amount: totalReturnAmount,
    refund_method: input.refundMethod,
    refund_status: refundPayableNow > 0 ? "refunded" : "pending",
    created_by: user.id,
  });

  await createBillReturnItems(
    supabase,
    input.items.map((item) => ({
      company_id: user.companyId,
      return_id: billReturn.id,
      bill_item_id: item.billItemId,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: Number((item.unitPrice * item.quantity).toFixed(2)),
    })),
  );

  if (refundPayableNow > 0 && salesReturnCategoryId) {
    const alreadyPosted = await existsEntryForSource(
      supabase,
      "bill_return",
      billReturn.id,
      input.refundAccountId,
    );

    if (!alreadyPosted) {
      const billNumber = bill.bill_number?.trim() || null;
      await createBillEntry(supabase, {
        company_id: user.companyId,
        entry_type: "expense",
        account_id: input.refundAccountId,
        category_id: salesReturnCategoryId,
        amount: refundPayableNow,
        entry_date: new Date().toISOString().slice(0, 10),
        remarks: billNumber
          ? `Refund for Bill #${billNumber}`
          : "Sales return refund",
        source_type: "bill_return",
        source_id: billReturn.id,
        payment_mode: input.refundMethod,
        created_by: user.id,
      });
    }

    await updateBillReturnRefundStatus(supabase, billReturn.id, "refunded");
  }

  const updatedReturned = await getReturnedQuantitiesByBillItem(
    supabase,
    input.billId,
  );
  const fullyReturned = billItems.every((item) => {
    const returned = updatedReturned.get(item.id) ?? 0;
    return returned >= item.quantity;
  });

  await updateBillStatus(supabase, input.billId, {
    status: fullyReturned ? "RETURNED" : "PARTIAL_RETURN",
    returnNote: input.returnNote ?? null,
    returnedAt: new Date().toISOString(),
  });

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Create",
    moduleName: "Returns",
    description: `Processed return ${billReturn.return_number}`,
    status: "Success",
    recordId: billReturn.id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  return {
    returnNumber: billReturn.return_number,
    refundAmount: refundPayableNow,
  };
}
