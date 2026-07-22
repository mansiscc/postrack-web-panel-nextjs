"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { loginAction } from "@/features/auth/actions";
import { loginSchema, type LoginInput } from "@/features/auth/schema";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const REMEMBER_EMAIL_KEY = "postrack.rememberEmail";

export function LoginForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberEmail: false,
    },
  });

  useEffect(() => {
    const remembered = localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (remembered) {
      form.setValue("email", remembered);
      form.setValue("rememberEmail", true);
    }
  }, [form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    if (values.rememberEmail) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, values.email);
    } else {
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }

    const result = await loginAction(values);

    if (!result.success) {
      setFormError(result.error);
      return;
    }

    router.push(result.redirectTo);
    router.refresh();
  });

  const isSubmitting = form.formState.isSubmitting;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormField
        label="Email"
        htmlFor="email"
        required
        error={form.formState.errors.email?.message}
      >
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@store.com"
          aria-invalid={Boolean(form.formState.errors.email)}
          {...form.register("email")}
        />
      </FormField>

      <FormField
        label="Password"
        htmlFor="password"
        required
        error={form.formState.errors.password?.message}
      >
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          aria-invalid={Boolean(form.formState.errors.password)}
          {...form.register("password")}
        />
      </FormField>

      <div className="flex items-center gap-2">
        <Checkbox
          id="rememberEmail"
          checked={form.watch("rememberEmail")}
          onCheckedChange={(checked) =>
            form.setValue("rememberEmail", checked === true)
          }
        />
        <Label htmlFor="rememberEmail" className="text-sm font-normal">
          Remember email
        </Label>
      </div>

      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
