import { PurchaseForm } from "@/features/purchases/components/purchase-form";
import { requireModuleAccess } from "@/lib/auth/session";
import { getPurchaseFormOptions } from "@/services/stock-in.service";

export default async function NewPurchasePage() {
  await requireModuleAccess("purchases");
  const options = await getPurchaseFormOptions();

  return (
    <PurchaseForm
      suppliers={options.suppliers}
      products={options.products}
      accounts={options.accounts}
      defaultAccountId={options.defaultAccountId}
    />
  );
}
