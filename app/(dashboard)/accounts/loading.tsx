import { ListPageSkeleton } from "@/components/feedback/page-skeleton";

export default function AccountsLoading() {
  return <ListPageSkeleton rows={8} filters={1} columns={4} />;
}
