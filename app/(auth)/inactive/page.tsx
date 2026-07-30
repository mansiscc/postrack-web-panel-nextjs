import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { logoutAction } from "@/hooks/features/auth/actions";
import { getAuthProfile } from "@/lib/auth/session";
import { AuthBrandHeader } from "@/components/brand/auth-brand-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Account suspended",
};

export default async function InactiveCompanyPage() {
  const profile = await getAuthProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.companyIsActive) {
    redirect("/");
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <AuthBrandHeader />

      <div className="space-y-6 rounded-2xl border border-border/60 bg-white/80 p-6 text-center shadow-sm backdrop-blur-sm sm:p-8">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <Lock className="size-6 text-destructive" strokeWidth={1.75} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Store account suspended
          </h1>
          <p className="text-sm text-muted-foreground">
            Access to{" "}
            <span className="font-medium text-foreground">
              {profile.companyName}
            </span>{" "}
            has been temporarily disabled.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Contact your POSTrack administrator or support to restore access to
          your store.
        </p>
        <form action={logoutAction}>
          <Button type="submit" variant="outline" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
