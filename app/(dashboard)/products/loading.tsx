import { ListPageSkeleton } from "@/components/feedback/page-skeleton";

export default function ProductsLoading() {
  return <ListPageSkeleton rows={8} filters={3} columns={5} />;
}
