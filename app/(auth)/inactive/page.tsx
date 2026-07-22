import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { logoutAction } from "@/features/auth/actions";
import { getAuthProfile } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <Card className="w-full max-w-lg border shadow-sm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <Lock className="size-6 text-destructive" strokeWidth={1.75} />
        </div>
        <CardTitle className="text-2xl font-semibold">
          Store account suspended
        </CardTitle>
        <CardDescription>
          Access to <span className="font-medium">{profile.companyName}</span>{" "}
          has been temporarily disabled.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Contact your POSTrack administrator or support to restore access to
          your store.
        </p>
        <form action={logoutAction}>
          <Button type="submit" variant="outline" className="w-full">
            Sign out
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
