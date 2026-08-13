import { notFound } from "next/navigation";

import { LabelPrintView } from "@/hooks/features/purchases/components/label-print-view";
import { requireModuleAccess } from "@/lib/auth/session";
import { getPurchaseDetail } from "@/services/stock-in.service";

type PrintLabelsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ item?: string }>;
};

export default async function PurchasePrintLabelsPage({
  params,
  searchParams,
}: PrintLabelsPageProps) {
  await requireModuleAccess("purchases");
  const { id } = await params;
  const { item: itemId } = await searchParams;
  const detail = await getPurchaseDetail(id);
  if (!detail) notFound();

  const mapped = detail.items.map((row) => ({
    productId: row.product_id,
    productName: row.product_name,
    barcode: row.barcode,
    quantity: Number(row.quantity),
    sellingPrice: row.selling_price,
    mrp: row.mrp,
    stockInItemId: row.id,
  }));

  // Android opens QR print for one stock-in line at a time.
  const items = itemId
    ? mapped.filter((row) => row.stockInItemId === itemId)
    : mapped;

  if (itemId && items.length === 0) notFound();

  return (
    <LabelPrintView
      title="Print QR Labels"
      backHref="/purchases"
      items={items.map(({ stockInItemId: _id, ...item }) => item)}
    />
  );
}
