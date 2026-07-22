import { headers } from "next/headers";

import { logActivity } from "@/lib/activity-log";
import {
  createBillReturn,
  createBillReturnItems,
  getBillItems,
  getReturnedQuantitiesByBillItem,
  updateBillStatus,
} from "@/repositories/bills.repository";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/types/auth";
import { AppError } from "@/utils/errors";

type ReturnInput = {
  billId: string;
  refundMethod: "Cash" | "UPI" | "Card" | "Mixed";
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
  const supabase = await createClient();
  const [billItems, returnedMap] = await Promise.all([
    getBillItems(supabase, input.billId),
    getReturnedQuantitiesByBillItem(supabase, input.billId),
  ]);

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

  const totalReturnAmount = input.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  const billReturn = await createBillReturn(supabase, {
    company_id: user.companyId,
    bill_id: input.billId,
    return_number: "",
    return_note: input.returnNote ?? null,
    total_return_amount: Number(totalReturnAmount.toFixed(2)),
    refund_method: input.refundMethod,
    refund_status: "refunded",
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

  return { returnNumber: billReturn.return_number };
}
