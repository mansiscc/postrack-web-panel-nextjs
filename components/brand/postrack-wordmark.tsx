import { cn } from "@/lib/utils";

type PostrackWordmarkProps = {
  className?: string;
  /** Text size class for the lockup. */
  size?: "sm" | "md" | "lg" | "xl";
};

const SIZE_CLASS = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
  xl: "text-4xl",
} as const;

export function PostrackWordmark({
  className,
  size = "md",
}: PostrackWordmarkProps) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-bold tracking-tight leading-none",
        SIZE_CLASS[size],
        className,
      )}
      aria-label="POSTrack"
    >
      <span className="text-primary">POS</span>
      <span className="text-foreground">Track</span>
    </span>
  );
}
