import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { mapSupabaseError } from "@/utils/errors";

export type CompanyProfile = Database["public"]["Tables"]["companies"]["Row"];

export async function getCompanyById(
  supabase: SupabaseClient<Database>,
  companyId: string,
): Promise<CompanyProfile | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();

  if (error) throw mapSupabaseError(error);
  return data;
}

export async function updateCompanyProfile(
  supabase: SupabaseClient<Database>,
  companyId: string,
  input: {
    businessName: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    gstin?: string | null;
    invoicePrefix: string;
    receiptFooter?: string | null;
    showLogoOnBill: boolean;
    logoUrl?: string | null;
  },
) {
  const { error } = await supabase
    .from("companies")
    .update({
      business_name: input.businessName.trim(),
      phone: input.phone?.trim() || null,
      owner_email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      gstin: input.gstin?.trim() || null,
      invoice_prefix: input.invoicePrefix.trim(),
      receipt_footer: input.receiptFooter?.trim() || null,
      show_logo_on_bill: input.showLogoOnBill,
      logo_url: input.logoUrl ?? null,
    })
    .eq("id", companyId);

  if (error) throw mapSupabaseError(error);
}
