const RATE_KEY = "postrack_demo_lead_timestamps";
const MAX_REQUESTS = 3;
const WINDOW_MS = 60 * 60 * 1000;

export function getLeadRateLimitError(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RATE_KEY);
    const timestamps: number[] = raw ? (JSON.parse(raw) as number[]) : [];
    const now = Date.now();
    const recent = timestamps.filter((ts) => now - ts < WINDOW_MS);
    if (recent.length >= MAX_REQUESTS) {
      const oldest = Math.min(...recent);
      const remainingMinutes = Math.max(
        1,
        Math.ceil((WINDOW_MS - (now - oldest)) / 60000),
      );
      return `You’ve reached the limit of ${MAX_REQUESTS} demo requests per hour. Please try again in ${remainingMinutes} minute(s).`;
    }
  } catch {
    return null;
  }
  return null;
}

export function recordLeadSubmitSuccess() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(RATE_KEY);
    const timestamps: number[] = raw ? (JSON.parse(raw) as number[]) : [];
    const now = Date.now();
    const recent = timestamps.filter((ts) => now - ts < WINDOW_MS);
    recent.push(now);
    localStorage.setItem(RATE_KEY, JSON.stringify(recent));
  } catch {
    // ignore storage failures
  }
}

export async function submitDemoLead(input: {
  fullName: string;
  phone: string;
  email: string;
  businessName: string;
  category?: string;
  message?: string;
  source: string;
  sourceDetail?: string;
}): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const rateError = getLeadRateLimitError();
  if (rateError) return { success: false, error: rateError };

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) {
    return { success: false, error: "Contact form is not configured." };
  }

  try {
    const response = await fetch(`${baseUrl}/functions/v1/create-lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        fullName: input.fullName,
        phone: input.phone,
        email: input.email,
        businessName: input.businessName,
        category: input.category || "",
        message: input.message || "",
        source: input.source || "website",
        sourceDetail: input.sourceDetail || "",
        platform: "web",
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
      fieldErrors?: Record<string, string[]>;
    };

    if (!response.ok) {
      const fieldMessage = payload.fieldErrors
        ? Object.values(payload.fieldErrors).flat()[0]
        : null;
      return {
        success: false,
        error:
          fieldMessage ||
          payload.error ||
          payload.message ||
          "Unable to submit right now. Please try again.",
      };
    }

    recordLeadSubmitSuccess();
    return {
      success: true,
      message:
        payload.message ||
        "Demo login details have been sent to your email. Please check your inbox and spam folder.",
    };
  } catch {
    return {
      success: false,
      error: "Network error. Please check your connection and try again.",
    };
  }
}
