import { cva, type VariantProps } from "class-variance-authority";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "h-auto border-transparent px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
  {
    variants: {
      status: {
        active: "bg-success-muted text-success-icon",
        inactive: "bg-destructive-muted text-destructive",
        deleted: "bg-destructive-muted text-destructive",
        paid: "bg-success-muted text-success-icon",
        partial: "bg-warning-muted text-warning-icon",
        unpaid: "bg-destructive-muted text-destructive",
        returned: "bg-info-muted text-info-accent",
        partial_return: "bg-partial-return/15 text-partial-return",
        pending: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      status: "active",
    },
  },
);

type StatusBadgeStatus = NonNullable<
  VariantProps<typeof statusBadgeVariants>["status"]
>;

type StatusBadgeProps = VariantProps<typeof statusBadgeVariants> & {
  label: string;
  className?: string;
  showDot?: boolean;
};

const statusDotColors: Record<StatusBadgeStatus, string> = {
  active: "bg-success-icon",
  inactive: "bg-destructive",
  deleted: "bg-destructive",
  paid: "bg-success-icon",
  partial: "bg-warning-icon",
  unpaid: "bg-destructive",
  returned: "bg-info-accent",
  partial_return: "bg-partial-return",
  pending: "bg-muted-foreground",
};

/** Map Android / DB bill status strings to badge variants. */
export function billStatusVariant(status: string): StatusBadgeStatus {
  switch (status) {
    case "PAID":
      return "paid";
    case "PARTIALLY_PAID":
      return "partial";
    case "UNPAID":
    case "PENDING":
      return "pending";
    case "RETURNED":
      return "returned";
    case "PARTIAL_RETURN":
      return "partial_return";
    case "CANCELLED":
      return "deleted";
    default:
      return "pending";
  }
}

/** Android BillStatusBadge display labels. */
export function billStatusLabel(status: string): string {
  switch (status) {
    case "PAID":
      return "PAID";
    case "PARTIALLY_PAID":
      return "PARTIAL";
    case "PENDING":
      return "PENDING";
    case "RETURNED":
      return "RETURNED";
    case "PARTIAL_RETURN":
      return "PARTIAL RETURN";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return status || "—";
  }
}

export function StatusBadge({
  status,
  label,
  className,
  showDot = false,
}: StatusBadgeProps) {
  const resolvedStatus = status ?? "active";

  return (
    <Badge
      variant="secondary"
      className={cn(
        statusBadgeVariants({ status: resolvedStatus }),
        showDot && "gap-1.5",
        className,
      )}
    >
      {showDot ? (
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            statusDotColors[resolvedStatus],
          )}
          aria-hidden
        />
      ) : null}
      {label}
    </Badge>
  );
}

type ActiveStatusToggleProps = {
  isActive: boolean;
  onToggle: (nextActive: boolean) => void;
  disabled?: boolean;
  className?: string;
};

/** Clickable Active/Inactive tag for table status columns. */
export function ActiveStatusToggle({
  isActive,
  onToggle,
  disabled = false,
  className,
}: ActiveStatusToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(!isActive);
      }}
      className={cn(
        "inline-flex cursor-pointer rounded-full transition-all hover:opacity-90 hover:ring-2 hover:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      aria-label={isActive ? "Set inactive" : "Set active"}
    >
      <StatusBadge
        status={isActive ? "active" : "inactive"}
        label={isActive ? "Active" : "Inactive"}
        showDot
      />
    </button>
  );
}
