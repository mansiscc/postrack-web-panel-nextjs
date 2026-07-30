import { ListPageSkeleton } from "@/components/feedback/page-skeleton";

export default function ActivityLogLoading() {
  return <ListPageSkeleton rows={8} filters={4} columns={5} />;
}
