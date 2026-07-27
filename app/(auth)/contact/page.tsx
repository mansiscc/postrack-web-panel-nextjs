import type { Metadata } from "next";

import { ContactUsForm } from "@/hooks/features/auth/components/contact-us-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Contact us",
};

export default function ContactPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Request a demo
        </CardTitle>
        <CardDescription>
          Tell us about your store and we&apos;ll send demo login details to your
          email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ContactUsForm />
      </CardContent>
    </Card>
  );
}
