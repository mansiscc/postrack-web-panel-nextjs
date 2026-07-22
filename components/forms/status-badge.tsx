import { cva, type VariantProps } from "class-variance-authority";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva("border-transparent font-medium", {
  variants: {
    status: {
      active: "bg-success/15 text-success",
      inactive: "bg-muted text-muted-foreground",
      deleted: "bg-destructive/10 text-destructive",
      paid: "bg-success/15 text-success",
      partial: "bg-warning/15 text-warning",
      unpaid: "bg-destructive/10 text-destructive",
      returned: "bg-info/15 text-info",
      pending: "bg-muted text-muted-foreground",
    },
  },
  defaultVariants: {
    status: "active",
  },
});

type StatusBadgeProps = VariantProps<typeof statusBadgeVariants> & {
  label: string;
  className?: string;
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(statusBadgeVariants({ status }), className)}
    >
      {label}
    </Badge>
  );
}
