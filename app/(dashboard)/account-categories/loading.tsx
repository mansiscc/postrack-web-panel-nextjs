import { ListPageSkeleton } from "@/components/feedback/page-skeleton";

export default function AccountCategoriesLoading() {
  return <ListPageSkeleton rows={8} filters={2} columns={4} />;
}
