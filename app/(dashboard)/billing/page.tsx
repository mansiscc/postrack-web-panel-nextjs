import { BillingWorkspace } from "@/hooks/features/billing/components/billing-workspace";
import { requireModuleAccess } from "@/lib/auth/session";
import { getBillingFormOptions } from "@/services/billing.service";

export default async function BillingPage() {
  const user = await requireModuleAccess("billing");
  const options = await getBillingFormOptions();

  return (
    <BillingWorkspace
      companyId={user.companyId}
      products={options.products}
      accounts={options.accounts}
      customers={options.customers}
      defaultAccountId={options.defaultAccountId}
    />
  );
}
