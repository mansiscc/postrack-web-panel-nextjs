import { ListPageSkeleton } from "@/components/feedback/page-skeleton";

export default function SuppliersLoading() {
  return <ListPageSkeleton rows={8} filters={0} columns={4} />;
}
