import type { Metadata } from "next";

import { AuthBrandHeader } from "@/components/brand/auth-brand-header";
import { LoginForm } from "@/hooks/features/auth/components/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="flex w-full flex-col gap-8">
      <AuthBrandHeader />

      <div className="space-y-6 rounded-2xl border border-border/60 bg-white/80 p-6 shadow-sm backdrop-blur-sm sm:p-8">
        <div className="space-y-1.5 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Sign in to POSTrack
          </h1>
          <p className="text-sm text-muted-foreground">
            Use your store admin credentials to access the panel.
          </p>
        </div>

        <LoginForm />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        <a
          href="https://postrack.in/privacy"
          target="_blank"
          rel="noreferrer"
          className="underline-offset-2 hover:underline"
        >
          Privacy
        </a>
        {" · "}
        <a
          href="https://postrack.in/terms"
          target="_blank"
          rel="noreferrer"
          className="underline-offset-2 hover:underline"
        >
          Terms
        </a>
      </p>
    </div>
  );
}
