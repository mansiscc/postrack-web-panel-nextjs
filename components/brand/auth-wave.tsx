import { cn } from "@/lib/utils";

type AuthWaveProps = {
  className?: string;
};

/**
 * Full-bleed vector wave. Curves stay inside the viewBox so nothing is
 * cropped when the SVG is scaled with preserveAspectRatio="none".
 */
export function AuthWave({ className }: AuthWaveProps) {
  return (
    <svg
      className={cn("h-full w-full", className)}
      viewBox="0 0 1440 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* Soft back wave — peak kept below y=20 so it never flat-clips */}
      <path
        d="M0 100C200 40 360 24 520 48C760 84 900 150 1100 158C1240 164 1360 130 1440 90V220H0V100Z"
        fill="url(#authWaveBack)"
        opacity="0.5"
      />
      {/* Front wave */}
      <path
        d="M0 140C220 90 380 72 560 100C780 136 920 178 1120 182C1260 184 1360 160 1440 130V220H0V140Z"
        fill="url(#authWaveFront)"
      />
      <defs>
        <linearGradient
          id="authWaveBack"
          x1="0"
          y1="40"
          x2="1440"
          y2="200"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F43F5E" />
          <stop offset="1" stopColor="#D2122E" />
        </linearGradient>
        <linearGradient
          id="authWaveFront"
          x1="0"
          y1="80"
          x2="1440"
          y2="220"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#E11D48" />
          <stop offset="0.55" stopColor="#D2122E" />
          <stop offset="1" stopColor="#BE123C" />
        </linearGradient>
      </defs>
    </svg>
  );
}
