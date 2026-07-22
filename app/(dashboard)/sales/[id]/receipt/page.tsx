import { notFound } from "next/navigation";

import { ReceiptView } from "@/features/sales/components/receipt-view";
import { requireModuleAccess } from "@/lib/auth/session";
import { getBillDetail } from "@/services/billing.service";

type ReceiptPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  await requireModuleAccess("sales");
  const { id } = await params;
  const detail = await getBillDetail(id);
  if (!detail) notFound();

  return (
    <ReceiptView
      bill={detail.bill}
      items={detail.items}
      customerName={detail.customerName}
      customerPhone={detail.customerPhone}
    />
  );
}
