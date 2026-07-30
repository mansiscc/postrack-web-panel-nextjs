import { cn } from "@/lib/utils";

type AuthCornerAccentProps = {
  className?: string;
};

/** Soft pink wash + halftone dots — vector, sharp at any size. */
export function AuthCornerAccent({ className }: AuthCornerAccentProps) {
  return (
    <svg
      className={cn("h-full w-full", className)}
      viewBox="0 0 480 360"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <radialGradient
          id="authCornerWash"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(480 0) rotate(135) scale(420 320)"
        >
          <stop stopColor="#FDA4AF" stopOpacity="0.85" />
          <stop offset="0.45" stopColor="#FECDD3" stopOpacity="0.45" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <pattern
          id="authHalftone"
          x="0"
          y="0"
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r="1.6" fill="#D2122E" fillOpacity="0.18" />
        </pattern>
        <linearGradient
          id="authHalftoneFade"
          x1="480"
          y1="0"
          x2="120"
          y2="280"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" />
          <stop offset="0.7" stopColor="white" stopOpacity="0.35" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id="authHalftoneMask">
          <rect width="480" height="360" fill="url(#authHalftoneFade)" />
        </mask>
      </defs>
      <path
        d="M140 0H480V240C400 200 340 120 280 60C230 18 180 0 140 0Z"
        fill="url(#authCornerWash)"
      />
      <rect
        width="480"
        height="360"
        fill="url(#authHalftone)"
        mask="url(#authHalftoneMask)"
      />
    </svg>
  );
}
