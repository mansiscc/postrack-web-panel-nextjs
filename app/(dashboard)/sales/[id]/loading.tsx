import { Loader2 } from "lucide-react";

export default function BillDetailsLoading() {
  return (
    <div className="flex w-full items-center justify-center py-24">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
