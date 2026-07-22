import type { Metadata } from "next";

import { LoginForm } from "@/features/auth/components/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <Card className="w-full max-w-md border shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Sign in to POSTrack
        </CardTitle>
        <CardDescription>
          Use your store admin credentials to access the panel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
