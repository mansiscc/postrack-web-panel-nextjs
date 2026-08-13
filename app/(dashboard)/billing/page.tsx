import { BillingWorkspace } from "@/hooks/features/billing/components/billing-workspace";
import { requireModuleAccess } from "@/lib/auth/session";
import { getBillingFormOptions } from "@/services/billing.service";
import { getBusinessProfile } from "@/services/business-profile.service";

export default async function BillingPage() {
  const user = await requireModuleAccess("billing");
  const [options, profile] = await Promise.all([
    getBillingFormOptions(),
    getBusinessProfile(user.companyId),
  ]);

  return (
    <BillingWorkspace
      companyId={user.companyId}
      products={options.products}
      accounts={options.accounts}
      customers={options.customers}
      defaultAccountId={options.defaultAccountId}
      businessName={profile?.business_name}
      receiptFooter={profile?.receipt_footer}
      logoUrl={profile?.logo_url}
      showLogoOnBill={profile?.show_logo_on_bill ?? true}
    />
  );
}
