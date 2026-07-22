import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { mapSupabaseError } from "@/utils/errors";
import { sanitizePostgrestSearch } from "@/utils/postgrest-filter";

export type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

type ListParams = {
  search?: string;
  includeInactive?: boolean;
};

export async function listCustomers(
  supabase: SupabaseClient<Database>,
  params: ListParams = {},
): Promise<CustomerRow[]> {
  let query = supabase
    .from("customers")
    .select("*")
    .order("name", { ascending: true });

  if (!params.includeInactive) {
    query = query.eq("is_active", true);
  }

  if (params.search?.trim()) {
    const term = sanitizePostgrestSearch(params.search);
    if (term) {
      query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
    }
  }

  const { data, error } = await query;
  if (error) throw mapSupabaseError(error);
  return data ?? [];
}

export async function getCustomerById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<CustomerRow | null> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw mapSupabaseError(error);
  return data;
}

export async function getCustomerByPhone(
  supabase: SupabaseClient<Database>,
  phone: string,
): Promise<CustomerRow | null> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("phone", phone.trim())
    .maybeSingle();

  if (error) throw mapSupabaseError(error);
  return data;
}

export async function createCustomer(
  supabase: SupabaseClient<Database>,
  input: {
    name: string;
    phone: string;
    email?: string | null;
    address?: string | null;
    companyId: string;
  },
) {
  const { data, error } = await supabase
    .from("customers")
    .insert({
      company_id: input.companyId,
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) throw mapSupabaseError(error);
  return data.id;
}

export async function updateCustomer(
  supabase: SupabaseClient<Database>,
  id: string,
  input: {
    name: string;
    phone: string;
    email?: string | null;
    address?: string | null;
    isActive: boolean;
  },
) {
  const { error } = await supabase
    .from("customers")
    .update({
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      is_active: input.isActive,
    })
    .eq("id", id);

  if (error) throw mapSupabaseError(error);
}

export async function listCustomerBills(
  supabase: SupabaseClient<Database>,
  customerId: string,
) {
  const { data, error } = await supabase
    .from("bills")
    .select(
      "id, bill_number, total_payable_amount, payment_mode, status, created_at",
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) throw mapSupabaseError(error);
  return data ?? [];
}
