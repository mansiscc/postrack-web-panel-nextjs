import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function: delete-user
 *
 * Deletes a tenant user:
 * - Soft delete (is_deleted=true, status=Inactive) when business references exist
 * - Hard delete (public.users + auth.users) when no references remain
 *
 * Request body: { user_id: string }
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

async function countActiveAdmins(companyId: string, excludeUserId?: string): Promise<number> {
  let query = adminClient
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("role", "Admin")
    .eq("status", "Active")
    .eq("is_deleted", false);

  if (excludeUserId) {
    query = query.neq("id", excludeUserId);
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
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

    const { user_id: userId } = await req.json();
    if (!userId || typeof userId !== "string") {
      return jsonResponse({ error: "user_id is required" }, 400);
    }

    if (userId === callerUser.id) {
      return jsonResponse({ error: "You cannot delete your own account" }, 400);
    }

    const { data: callerRow, error: callerRowError } = await adminClient
      .from("users")
      .select("role, company_id, status, is_deleted")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (
      callerRowError ||
      !callerRow ||
      callerRow.role !== "Admin" ||
      callerRow.status !== "Active" ||
      callerRow.is_deleted
    ) {
      return jsonResponse({ error: "Forbidden – admin only" }, 403);
    }

    const callerCompanyId =
      callerRow.company_id != null ? String(callerRow.company_id) : null;
    if (!callerCompanyId) {
      return jsonResponse({ error: "Admin account has no company_id" }, 400);
    }

    const { data: targetRow, error: targetError } = await adminClient
      .from("users")
      .select("id, company_id, role, status, is_deleted, full_name, email")
      .eq("id", userId)
      .maybeSingle();

    if (targetError || !targetRow) {
      return jsonResponse({ error: "User not found" }, 404);
    }

    const targetCompanyId =
      targetRow.company_id != null ? String(targetRow.company_id) : null;
    if (!targetCompanyId || targetCompanyId !== callerCompanyId) {
      return jsonResponse(
        { error: "Forbidden – can only delete users in your company" },
        403,
      );
    }

    if (targetRow.is_deleted) {
      return jsonResponse({ error: "User is already deleted" }, 409);
    }

    if (
      targetRow.role === "Admin" &&
      targetRow.status === "Active"
    ) {
      const otherActiveAdmins = await countActiveAdmins(callerCompanyId, userId);
      if (otherActiveAdmins < 1) {
        return jsonResponse(
          { error: "Cannot delete the last active admin" },
          400,
        );
      }
    }

    const { data: hasReferences, error: refError } = await adminClient.rpc(
      "user_has_business_references",
      { p_user_id: userId },
    );

    if (refError) {
      return jsonResponse({ error: refError.message }, 500);
    }

    if (hasReferences === true) {
      const { error: softError } = await adminClient
        .from("users")
        .update({ is_deleted: true, status: "Inactive" })
        .eq("id", userId);

      if (softError) {
        return jsonResponse({ error: softError.message }, 400);
      }

      return jsonResponse({
        user_id: userId,
        action: "soft_deleted",
        full_name: targetRow.full_name,
      });
    }

    const { error: hardRowError } = await adminClient.rpc(
      "hard_delete_user_row",
      { p_user_id: userId },
    );

    if (hardRowError) {
      return jsonResponse({ error: hardRowError.message }, 400);
    }

    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(
      userId,
    );

    if (authDeleteError) {
      return jsonResponse(
        {
          error:
            "User profile removed but auth account deletion failed: " +
            authDeleteError.message,
        },
        500,
      );
    }

    return jsonResponse({
      user_id: userId,
      action: "hard_deleted",
      full_name: targetRow.full_name,
    });
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
});
