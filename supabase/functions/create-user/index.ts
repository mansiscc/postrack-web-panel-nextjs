import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEYS")!;
const ANON_KEY = Deno.env.get("ANON_KEY")!;

// Admin client (service role) used for privileged operations
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// This add in Supabase => Edge Functions => Secrets
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  try {
    // 0) Verify caller is logged-in Admin based on public.users
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Client scoped to caller JWT to validate session and read their role
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: callerUser },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized – invalid session" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Load caller profile with service role so company_id is always present for the
    // authenticated user id (avoids anon/RLS edge cases where company_id was missing).
    const { data: callerRow, error: callerRowError } = await adminClient
      .from("users")
      .select("role, company_id")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (callerRowError || !callerRow || callerRow.role !== "Admin") {
      return new Response(
        JSON.stringify({ error: "User not allowed – admin only" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const callerCompanyId =
      callerRow.company_id != null ? String(callerRow.company_id) : null;
    if (!callerCompanyId) {
      return new Response(
        JSON.stringify({ error: "Admin account has no company_id" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
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

    // 1) Create user in Auth (admin)
    const { data: authUser, error: authError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authUser?.user) {
      return new Response(
        JSON.stringify({ error: authError?.message ?? "Auth create failed" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const userId = authUser.user.id;

    // 2) Insert into public.users
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
      // 3) Roll back auth user if DB insert fails
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 3) Insert user_permissions when Staff and flags provided
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
        // Rollback if permissions insert fails
        await adminClient.rpc("hard_delete_user_row", { p_user_id: userId });
        await adminClient.auth.admin.deleteUser(userId);
        return new Response(
          JSON.stringify({ error: permError.message }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    return new Response(
      JSON.stringify(row),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
