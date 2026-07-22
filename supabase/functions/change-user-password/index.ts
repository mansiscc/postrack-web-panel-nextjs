import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function: change-user-password
 *
 * Updates a tenant user's Supabase Auth password.
 *
 * Callers:
 * - POSTrack mobile: company Admin changing a teammate's password (same company_id)
 * - POSTrack admin panel: active platform super_admin (any tenant user)
 *
 * Request body: { user_id: string, new_password: string (min 6) }
 */

function envRequired(name: string, value: string | undefined): string {
  const v = value?.trim();
  if (!v) throw new Error(`Missing required Edge secret/env: ${name}`);
  return v;
}

const SUPABASE_URL = envRequired(
  "SUPABASE_URL",
  Deno.env.get("SUPABASE_URL"),
);
const SERVICE_ROLE_KEY = envRequired(
  "SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEYS",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEYS"),
);
const ANON_KEY = envRequired(
  "SUPABASE_ANON_KEY or ANON_KEY",
  Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("ANON_KEY"),
);

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
    }

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: callerUser },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !callerUser) {
      return jsonResponse({ error: "Unauthorized – invalid session" }, 401);
    }

    const { user_id: userId, new_password: newPassword } = await req.json();

    if (!userId || typeof userId !== "string") {
      return jsonResponse({ error: "user_id is required" }, 400);
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return jsonResponse(
        { error: "new_password must be at least 6 characters" },
        400,
      );
    }

    const { data: targetRow, error: targetError } = await adminClient
      .from("users")
      .select("id, company_id, email, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (targetError || !targetRow) {
      return jsonResponse({ error: "User not found" }, 404);
    }

    const { data: superRow } = await adminClient
      .from("super_admins")
      .select("id, status")
      .eq("id", callerUser.id)
      .maybeSingle();

    const isSuperAdmin = superRow?.status === "Active";

    if (!isSuperAdmin) {
      const { data: callerRow, error: callerRowError } = await adminClient
        .from("users")
        .select("role, company_id")
        .eq("id", callerUser.id)
        .maybeSingle();

      if (callerRowError || !callerRow || callerRow.role !== "Admin") {
        return jsonResponse({ error: "Forbidden – admin or super admin only" }, 403);
      }

      const callerCompanyId =
        callerRow.company_id != null ? String(callerRow.company_id) : null;
      const targetCompanyId =
        targetRow.company_id != null ? String(targetRow.company_id) : null;

      if (!callerCompanyId || !targetCompanyId || callerCompanyId !== targetCompanyId) {
        return jsonResponse(
          { error: "Forbidden – can only change passwords for users in your company" },
          403,
        );
      }
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      userId,
      { password: newPassword },
    );

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 400);
    }

    if (isSuperAdmin) {
      try {
        await adminClient.rpc("log_super_admin_activity", {
          p_user_id: callerUser.id,
          p_action_type: "Update",
          p_module_name: "Users",
          p_record_id: userId,
          p_description: `Password reset for ${targetRow.email ?? targetRow.full_name ?? userId}`,
          p_status: "Success",
          p_ip_address: req.headers.get("x-forwarded-for") ?? null,
          p_old_values: null,
          p_new_values: null,
        });
      } catch {
        // never block response
      }
    }

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
});
