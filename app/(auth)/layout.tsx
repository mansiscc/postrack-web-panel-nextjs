import type { Metadata } from "next";

import { AuthCornerAccent } from "@/components/brand/auth-corner-accent";
import { AuthWave } from "@/components/brand/auth-wave";
import { SkipToMain } from "@/components/layout/skip-to-main";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#FFFBFC]">
      <SkipToMain />

      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute top-0 right-0 h-[min(42vh,360px)] w-[min(70vw,480px)] opacity-90">
          <AuthCornerAccent />
        </div>

        {/* Full crest visible — no overflow clip on the wave */}
        <div className="absolute inset-x-0 bottom-0 h-40 sm:h-52">
          <div className="auth-wave-float absolute inset-x-0 bottom-0 h-full w-full">
            <AuthWave />
          </div>
        </div>

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(210,18,46,0.04),transparent_55%)]" />
      </div>

      <main
        id="main-content"
        tabIndex={-1}
        className="relative z-10 flex h-full flex-col items-center justify-center overflow-hidden px-4 py-10 pb-28 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-6 sm:pb-32"
      >
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
