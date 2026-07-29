import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { AppError } from "@/utils/errors";

function getFunctionsBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!url) {
    throw new AppError("Supabase URL is not configured.", "CONFIG_ERROR", 500);
  }
  return `${url}/functions/v1`;
}

function getAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new AppError("Supabase anon key is not configured.", "CONFIG_ERROR", 500);
  }
  return key;
}

function resolveHttpError(status: number, payload: unknown): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const message = String((payload as { error: unknown }).error).trim();
    if (message) return message;
  }

  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) {
    return "This feature is not available yet. Deploy the Edge Function on Supabase.";
  }

  return `Request failed (${status}). Please try again.`;
}

export async function invokeAuthenticatedFunction<T = unknown>(
  supabase: SupabaseClient<Database>,
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AppError("Your session has expired. Please sign in again.", "UNAUTHORIZED", 401);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new AppError("Your session has expired. Please sign in again.", "UNAUTHORIZED", 401);
  }

  const response = await fetch(`${getFunctionsBaseUrl()}/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: getAnonKey(),
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: unknown;
  };

  if (!response.ok) {
    throw new AppError(
      resolveHttpError(response.status, payload),
      "EDGE_FUNCTION_ERROR",
    );
  }

  if (payload && typeof payload === "object" && "error" in payload) {
    throw new AppError(String(payload.error), "EDGE_FUNCTION_ERROR");
  }

  return payload as T;
}
