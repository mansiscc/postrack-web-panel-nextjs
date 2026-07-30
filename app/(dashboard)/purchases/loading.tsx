import { ListPageSkeleton } from "@/components/feedback/page-skeleton";

export default function PurchasesLoading() {
  return <ListPageSkeleton rows={8} filters={0} columns={5} />;
}
