import { headers } from "next/headers";

import { logActivity } from "@/lib/activity-log";
import {
  createCustomer,
  getCustomerById,
  getCustomerByPhone,
  listCustomerBills,
  listCustomers,
  updateCustomer,
} from "@/repositories/customers.repository";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/types/auth";
import { AppError } from "@/utils/errors";

type CustomerInput = {
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  isActive?: boolean;
};

export async function getCustomersList(params?: {
  search?: string;
  status?: "all" | "active" | "inactive";
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const supabase = await createClient();
  return listCustomers(supabase, params);
}

export async function getCustomerDetail(customerId: string) {
  const supabase = await createClient();
  const [customer, bills] = await Promise.all([
    getCustomerById(supabase, customerId),
    listCustomerBills(supabase, customerId),
  ]);
  return { customer, bills };
}

export async function createCustomerRecord(
  user: SessionUser,
  input: CustomerInput,
) {
  const supabase = await createClient();
  const existing = await getCustomerByPhone(supabase, input.phone);
  if (existing) {
    throw new AppError(
      "A customer with this phone number already exists",
      "DUPLICATE_PHONE",
    );
  }

  const id = await createCustomer(supabase, {
    ...input,
    companyId: user.companyId,
  });

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Create",
    moduleName: "Customers",
    description: `Created customer "${input.name}"`,
    status: "Success",
    recordId: id,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  return id;
}

export async function updateCustomerRecord(
  user: SessionUser,
  customerId: string,
  input: CustomerInput,
) {
  const supabase = await createClient();
  const existing = await getCustomerById(supabase, customerId);
  if (!existing) throw new AppError("Customer not found", "NOT_FOUND", 404);

  const phoneOwner = await getCustomerByPhone(supabase, input.phone);
  if (phoneOwner && phoneOwner.id !== customerId) {
    throw new AppError(
      "A customer with this phone number already exists",
      "DUPLICATE_PHONE",
    );
  }

  await updateCustomer(supabase, customerId, {
    name: input.name,
    phone: input.phone,
    email: input.email,
    address: input.address,
    isActive: input.isActive ?? existing.is_active,
  });

  const headerStore = await headers();
  await logActivity(supabase, {
    userId: user.id,
    userName: user.fullName,
    companyId: user.companyId,
    actionType: "Update",
    moduleName: "Customers",
    description: `Updated customer "${input.name}"`,
    status: "Success",
    recordId: customerId,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });
}

export async function resolveBillingCustomer(
  user: SessionUser,
  input: {
    customerId?: string | null;
    customerName?: string;
    customerPhone?: string;
  },
): Promise<string | null> {
  if (input.customerId) return input.customerId;

  const phone = input.customerPhone?.trim();
  const name = input.customerName?.trim();
  if (!phone) return null;

  const supabase = await createClient();
  const existing = await getCustomerByPhone(supabase, phone);
  if (existing) return existing.id;

  if (!name) {
    throw new AppError(
      "Customer name is required for a new phone number",
      "VALIDATION_ERROR",
    );
  }

  return createCustomer(supabase, {
    name,
    phone,
    companyId: user.companyId,
  });
}
