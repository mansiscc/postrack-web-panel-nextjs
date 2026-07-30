import Image from "next/image";

import { cn } from "@/lib/utils";

export const POSTRACK_LOGO_SRC = "/assets/images/postrack-logo-full.png";

type PostrackLogoProps = {
  className?: string;
  /** Rendered image size in CSS pixels (square). */
  size?: number;
  priority?: boolean;
};

export function PostrackLogo({
  className,
  size = 32,
  priority = false,
}: PostrackLogoProps) {
  return (
    <Image
      src={POSTRACK_LOGO_SRC}
      alt="POSTrack"
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
