import { notFound } from "next/navigation";

import { ProductDetailsView } from "@/hooks/features/products/components/product-details-view";
import {
  mapProductRow,
  parseProductDetailsPayload,
} from "@/hooks/features/products/types";
import { requireModuleAccess } from "@/lib/auth/session";
import { getCategoriesList } from "@/services/category.service";
import {
  getProductByIdRecord,
  getProductDetailBundle,
} from "@/services/product.service";

type ProductDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductDetailsPage({
  params,
}: ProductDetailsPageProps) {
  const user = await requireModuleAccess("products");
  const { id } = await params;

  const [productRow, bundle, categories] = await Promise.all([
    getProductByIdRecord(id),
    getProductDetailBundle(id),
    getCategoriesList({ status: "active" }),
  ]);

  if (!productRow) notFound();

  const details = parseProductDetailsPayload(bundle.details);
  if (!details) notFound();

  return (
    <ProductDetailsView
      product={mapProductRow(productRow)}
      details={details}
      categories={categories.items.map((category) => ({
        id: category.id,
        name: category.name,
      }))}
      canDelete={user.role === "Admin"}
    />
  );
}
