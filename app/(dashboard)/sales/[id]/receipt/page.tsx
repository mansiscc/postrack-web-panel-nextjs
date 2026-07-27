import { notFound } from "next/navigation";

import { ReceiptView } from "@/hooks/features/sales/components/receipt-view";
import { requireModuleAccess } from "@/lib/auth/session";
import { getBillDetail } from "@/services/billing.service";
import { getBusinessProfile } from "@/services/business-profile.service";

type ReceiptPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const user = await requireModuleAccess("sales");
  const { id } = await params;
  const [detail, profile] = await Promise.all([
    getBillDetail(id),
    getBusinessProfile(user.companyId),
  ]);
  if (!detail) notFound();

  return (
    <ReceiptView
      bill={detail.bill}
      items={detail.items}
      customerName={detail.customerName}
      customerPhone={detail.customerPhone}
      businessName={profile?.business_name}
      receiptFooter={profile?.receipt_footer}
    />
  );
}
