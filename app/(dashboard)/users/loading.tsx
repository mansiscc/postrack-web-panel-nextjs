import { ListPageSkeleton } from "@/components/feedback/page-skeleton";

export default function UsersLoading() {
  return <ListPageSkeleton rows={8} filters={1} columns={4} />;
}
