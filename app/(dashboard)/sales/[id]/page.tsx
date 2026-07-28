import { notFound } from "next/navigation";

import { BillDetailsView } from "@/hooks/features/sales/components/bill-details-view";
import { requireModuleAccess } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultAccount,
  listActiveAccounts,
} from "@/repositories/accounts.repository";
import { getBillDetail } from "@/services/billing.service";

type BillDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BillDetailsPage({
  params,
}: BillDetailsPageProps) {
  await requireModuleAccess("sales");
  const { id } = await params;

  const supabase = await createClient();
  const [detail, accounts, defaultAccount] = await Promise.all([
    getBillDetail(id),
    listActiveAccounts(supabase),
    getDefaultAccount(supabase),
  ]);

  if (!detail) notFound();

  return (
    <BillDetailsView
      detail={detail}
      accounts={accounts}
      defaultAccountId={defaultAccount?.id ?? accounts[0]?.id ?? null}
    />
  );
}
