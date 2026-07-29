import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function: create-user
 *
 * Creates a tenant user in Auth + public.users (+ optional staff permissions).
 * Caller must be an Admin in the same company.
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
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Missing or invalid Authorization header" },
        401,
      );
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

    const { data: callerRow, error: callerRowError } = await adminClient
      .from("users")
      .select("role, company_id")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (callerRowError || !callerRow || callerRow.role !== "Admin") {
      return jsonResponse({ error: "User not allowed – admin only" }, 403);
    }

    const callerCompanyId =
      callerRow.company_id != null ? String(callerRow.company_id) : null;
    if (!callerCompanyId) {
      return jsonResponse({ error: "Admin account has no company_id" }, 400);
    }

    const {
      fullName,
      email,
      password,
      phone,
      role,
      status,
      createdBy,
      permissionStockIn,
      permissionStockOut,
    } = await req.json();

    const { data: authUser, error: authError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authUser?.user) {
      return jsonResponse(
        { error: authError?.message ?? "Auth create failed" },
        400,
      );
    }

    const userId = authUser.user.id;

    const { data: row, error: insertError } = await adminClient
      .from("users")
      .insert({
        id: userId,
        company_id: callerCompanyId,
        full_name: fullName,
        email,
        phone,
        role,
        status: status ?? "Active",
        created_by: createdBy,
      })
      .select()
      .single();

    if (insertError) {
      await adminClient.auth.admin.deleteUser(userId);
      return jsonResponse({ error: insertError.message }, 400);
    }

    if (role === "Staff" && (permissionStockIn || permissionStockOut)) {
      const rows: { user_id: string; permission: string; granted: boolean }[] =
        [];
      if (permissionStockIn) {
        rows.push({ user_id: userId, permission: "stock_in", granted: true });
      }
      if (permissionStockOut) {
        rows.push({ user_id: userId, permission: "stock_out", granted: true });
      }

      const { error: permError } = await adminClient
        .from("user_permissions")
        .insert(rows);

      if (permError) {
        await adminClient.rpc("hard_delete_user_row", { p_user_id: userId });
        await adminClient.auth.admin.deleteUser(userId);
        return jsonResponse({ error: permError.message }, 400);
      }
    }

    return jsonResponse(row, 200);
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
});
