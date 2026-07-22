import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function: provision-company-admin
 *
 * Purpose:
 * - Called from POSTrack admin panel (super_admins only) after a lead is
 *   converted into a company.
 * - Creates a Supabase Auth user for the company owner (email + temp password)
 * - Inserts a tenant Admin row into public.users linked to that company
 * - Sends credentials email via Mailtrap Transactional API
 *
 * Env:
 * - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY — injected automatically when the
 *   function is linked to a Supabase project (preferred).
 * - Legacy aliases still supported: SERVICE_ROLE_KEYS, ANON_KEY (manual secrets).
 * - MAILTRAP_API_KEY       = <Mailtrap API token>
 * - MAIL_FROM_EMAIL        = <from email configured in Mailtrap>
 * - MAIL_FROM_NAME         = <optional sender name> (default: "POSTrack")
 * - POSTRACK_MOBILE_APP_LINK = <optional mobile app URL shown in email>
 * - POSTRACK_WEBSITE_URL     = <optional website URL shown in email>
 * - POSTRACK_ADMIN_PANEL_URL = <optional base URL of deployed admin panel, no trailing slash>
 *   Used to build the welcome-email logo URL: {base}/assets/images/postrack-logo-full.png
 * - POSTRACK_EMAIL_LOGO_URL = <optional full URL override> for that logo (takes precedence)
 * - MAILTRAP_SEND_ENDPOINT = <optional override> (default: transactional endpoint)
 */

function envRequired(name: string, value: string | undefined): string {
  const v = value?.trim();
  if (!v) throw new Error(`Missing required Edge secret/env: ${name}`);
  return v;
}

/** Supabase injects SUPABASE_*; older docs used SERVICE_ROLE_KEYS / ANON_KEY manually. */
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

const MAILTRAP_API_KEY = Deno.env.get("MAILTRAP_API_KEY") ?? "";
const MAIL_FROM_EMAIL = Deno.env.get("MAIL_FROM_EMAIL") ?? "";
const MAIL_FROM_NAME = Deno.env.get("MAIL_FROM_NAME") ?? "POSTrack";
// Optional links used in the welcome email
const POSTRACK_MOBILE_APP_LINK = Deno.env.get("POSTRACK_MOBILE_APP_LINK") ?? "";
const POSTRACK_WEBSITE_URL = Deno.env.get("POSTRACK_WEBSITE_URL") ?? "https://postrack.in";

/** Welcome email header logo (same asset as admin panel `public/assets/images/postrack-logo-full.png`). */
function postrackEmailLogoUrl(): string {
  const explicit = Deno.env.get("POSTRACK_EMAIL_LOGO_URL")?.trim();
  if (explicit) return explicit;
  const adminBase = Deno.env.get("POSTRACK_ADMIN_PANEL_URL")?.trim().replace(/\/+$/, "");
  if (adminBase) return `${adminBase}/assets/images/postrack-logo-full.png`;
  return "";
}

/** Lucide-style inline SVG for HTML email (stroke icons, lucide-icons/lucide 0.447 paths). */
function lucideSvg(
  paths: string,
  opts?: { stroke?: string; size?: number; margin?: string },
): string {
  const stroke = opts?.stroke ?? "#be123c";
  const size = opts?.size ?? 18;
  const margin = opts?.margin ?? "margin-right:6px;";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-hidden="true" style="display:inline-block;vertical-align:-4px;${margin}">${paths}</svg>`;
}

// Party popper, lock-keyhole, mouse-pointer-2, globe, rocket, building-2, pin (Lucide)
const LUCIDE_PARTY_POPPER =
  `<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>`;
const LUCIDE_LOCK_KEYHOLE =
  `<circle cx="12" cy="16" r="1"/><rect x="3" y="10" width="18" height="12" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/>`;
const LUCIDE_MOUSE_POINTER =
  `<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>`;
const LUCIDE_GLOBE =
  `<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>`;
const LUCIDE_ROCKET =
  `<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>`;
const LUCIDE_BUILDING_2 =
  `<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>`;
const LUCIDE_PIN =
  `<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>`;
// Transactional endpoint per Mailtrap docs:
// https://docs.mailtrap.io/developers#email-sending-options
const MAILTRAP_SEND_ENDPOINT =
  Deno.env.get("MAILTRAP_SEND_ENDPOINT") ?? "https://send.api.mailtrap.io/api/send";

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function generateTempPassword(length = 12): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  let pwd = "";
  for (let i = 0; i < length; i++) {
    pwd += chars[array[i]! % chars.length];
  }
  return pwd;
}

async function sendMailtrapEmail(params: {
  toEmail: string;
  ownerName: string | null;
  companyName: string;
  tempPassword: string;
}) {
  if (!MAILTRAP_API_KEY || !MAIL_FROM_EMAIL) {
    // In non-configured environments we quietly skip email sending so that
    // local testing can still exercise user creation without failing.
    return { sent: false, skipped: true, error: "Mailtrap not configured" };
  }

  const { toEmail, ownerName, companyName, tempPassword } = params;

  const subject = "Welcome to POSTrack";
  const mobileAppLink = POSTRACK_MOBILE_APP_LINK.trim();
  const websiteLink = POSTRACK_WEBSITE_URL.trim();
  const greetingName = ownerName?.trim() || "there";

  const plainText = [
    `Hello ${greetingName},`,
    "",
    "Welcome to POSTrack",
    "Your business account has been successfully created and is ready to use.",
    "",
    "---",
    "",
    "Login Credentials",
    "",
    `Company Name: ${companyName}`,
    `Login Email: ${toEmail}`,
    `Temporary Password: ${tempPassword}`,
    "",
    "For security reasons, please change your password after your first login.",
    "",
    "---",
    "",
    "Access Your Account",
    "",
    "Mobile App:",
    mobileAppLink || "—",
    "",
    ...(websiteLink ? ["Website:", websiteLink, ""] : []),
    "---",
    "",
    "What You Can Do with POSTrack",
    "",
    "POSTrack helps you manage your business efficiently with:",
    "",
    "• Billing & Invoice Management",
    "• Inventory Tracking",
    "• Sales & Reports Dashboard",
    "• Staff Management",
    "• Real-time business insights",
    "",
    "---",
    "",
    "Your Business is Now Live",
    "",
    "Your company account is fully activated and ready to start billing, managing products, and tracking sales.",
    "",
    "---",
    "",
    "Need Help?",
    "",
    "If you have any questions or need assistance, feel free to reply to this email.",
    "We’re here to help you get started smoothly.",
    "",
    "---",
    "",
    "Best regards,",
    "POSTrack Team",
  ].join("\n");

  const logoUrl = postrackEmailLogoUrl();
  const headingIconStroke = "#111827";
  const safeWebsiteLink = websiteLink.replace(/"/g, "&quot;");
  const websiteHtml = websiteLink
    ? `<div style="margin-top:16px; padding:14px; border:1px solid #e5e7eb; border-radius:12px; background:#fafafa;">
            <p style="margin:0 0 6px 0; font-size:13.5px;"><strong>${lucideSvg(LUCIDE_GLOBE, { stroke: headingIconStroke })}Website:</strong></p>
            <a href="${safeWebsiteLink}" style="color:#2563eb; text-decoration:none; font-size:13.5px; word-break:break-all;">${websiteLink}</a>
          </div>`
    : "";

  const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Welcome to POSTrack</title>
  </head>
  <body style="margin:0; padding:24px; background:#f9fafb; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#111827;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:14px; border:1px solid #e5e7eb; overflow:hidden;">
      <tr>
        <td style="padding:22px 26px 10px 26px; background: linear-gradient(135deg, #fdf2f8 0%, #fff7ed 100%); border-bottom:1px solid #e5e7eb;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="vertical-align:top;">
                <h1 style="margin:0; font-size:20px; font-weight:800; letter-spacing:-0.02em;">
                  Welcome to <span style="color:#be123c;">POSTrack</span>
                  ${lucideSvg(LUCIDE_PARTY_POPPER, { stroke: "#be123c", size: 20, margin: "margin-left:6px;margin-right:0;" })}
                </h1>
                <p style="margin:10px 0 0 0; font-size:14px; color:#374151;">Hello ${greetingName},</p>
                <p style="margin:8px 0 0 0; font-size:14px; color:#4b5563;">
                  Your business account has been successfully created and is ready to use.
                </p>
              </td>
              <td align="right" valign="top" width="1%" style="padding-left:12px;white-space:nowrap;">
                ${
                  logoUrl
                    ? `<img src="${logoUrl.replace(/"/g, "&quot;")}" alt="POSTrack" width="132" style="display:block;max-width:132px;width:132px;height:auto;border:0;outline:none;text-decoration:none;" />`
                    : ""
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:18px 26px 6px 26px;">
          <h2 style="margin:0; font-size:15px; font-weight:900;">${lucideSvg(LUCIDE_LOCK_KEYHOLE, { stroke: headingIconStroke })}Login Credentials</h2>

          <div style="margin-top:10px; padding:14px; border:1px solid #e5e7eb; border-radius:12px; background:#fafafa;">
            <p style="margin:0 0 8px 0; font-size:13.5px;"><strong>Company Name:</strong> ${companyName}</p>
            <p style="margin:0 0 8px 0; font-size:13.5px;"><strong>Login Email:</strong> ${toEmail}</p>
            <p style="margin:0; font-size:13.5px;"><strong>Temporary Password:</strong> <span style="color:#b91c1c; font-weight:800;">${tempPassword}</span></p>
          </div>

          <p style="margin:12px 0 0 0; font-size:13px; color:#4b5563;">
            ${lucideSvg(LUCIDE_MOUSE_POINTER, { stroke: "#6b7280", size: 16, margin: "margin-right:8px;" })}
            For security reasons, please change your password after your first login.
          </p>
        </td>
      </tr>

      <tr>
        <td style="padding:16px 26px 6px 26px;">
          <h2 style="margin:0; font-size:15px; font-weight:900;">${lucideSvg(LUCIDE_GLOBE, { stroke: headingIconStroke })}Access Your Account</h2>

          <div style="margin-top:10px; padding:14px; border:1px solid #e5e7eb; border-radius:12px;">
            <p style="margin:0; font-size:13.5px;"><strong>Mobile App:</strong><br/>
              ${
                mobileAppLink
                  ? `<a href="${mobileAppLink}" style="color:#2563eb; text-decoration:none;">${mobileAppLink}</a>`
                  : "—"
              }
            </p>
          </div>

          ${websiteHtml}

          <div style="margin-top:16px;">
            <h2 style="margin:0; font-size:15px; font-weight:900;">${lucideSvg(LUCIDE_ROCKET, { stroke: headingIconStroke })}What You Can Do with POSTrack</h2>
            <p style="margin:10px 0 0 0; font-size:13.5px; color:#374151;">POSTrack helps you manage your business efficiently with:</p>
            <ul style="margin:10px 0 0 18px; padding:0; font-size:13.5px; color:#374151; line-height:1.55;">
              <li>Billing &amp; Invoice Management</li>
              <li>Inventory Tracking</li>
              <li>Sales &amp; Reports Dashboard</li>
              <li>Staff Management</li>
              <li>Real-time business insights</li>
            </ul>
          </div>

          <div style="margin-top:16px;">
            <h2 style="margin:0; font-size:15px; font-weight:900;">${lucideSvg(LUCIDE_BUILDING_2, { stroke: headingIconStroke })}Your Business is Now Live</h2>
            <p style="margin:10px 0 0 0; font-size:13.5px; color:#374151;">
              Your company account is fully activated and ready to start billing, managing products, and tracking sales.
            </p>
          </div>

          <div style="margin-top:16px;">
            <h2 style="margin:0; font-size:15px; font-weight:900;">${lucideSvg(LUCIDE_PIN, { stroke: headingIconStroke })}Need Help?</h2>
            <p style="margin:10px 0 0 0; font-size:13.5px; color:#374151;">
              If you have any questions or need assistance, feel free to reply to this email.<br/>
              We’re here to help you get started smoothly.
            </p>
          </div>

          <p style="margin:18px 0 0 0; font-size:13.5px; color:#111827;">
            Best regards,<br/>
            <strong>POSTrack Team</strong>
          </p>
        </td>
      </tr>

      <tr>
        <td style="padding:16px 26px 18px 26px; border-top:1px solid #e5e7eb; color:#9ca3af; font-size:11px;">
          This email was sent by POSTrack Team.
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  const payload = {
    from: { email: MAIL_FROM_EMAIL, name: MAIL_FROM_NAME },
    to: [{ email: toEmail }],
    subject,
    text: plainText,
    html,
  };

  let resp: Response;
  try {
    resp = await fetch(MAILTRAP_SEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MAILTRAP_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!resp.ok) {
    const raw = await resp.text();
    // Mailtrap errors are often JSON; keep raw as fallback for debugging.
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    const message =
      (typeof parsed === "object" && parsed && "message" in parsed &&
          typeof (parsed as { message?: unknown }).message === "string")
        ? (parsed as { message: string }).message
        : (raw || resp.statusText);

    return {
      sent: false,
      skipped: false,
      error: `Mailtrap send failed (${resp.status}): ${message}`,
    };
  }

  return { sent: true, skipped: false, error: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    // CORS preflight request
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

    // Caller client (super_admin) using anon key + caller JWT
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

    // Ensure caller is an active super admin (admin panel operator)
    const { data: superRow, error: superErr } = await callerClient
      .from("super_admins")
      .select("id, status")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (superErr || !superRow || superRow.status !== "Active") {
      return jsonResponse({ error: "Forbidden – super admin only" }, 403);
    }

    const body = await req.json();
    const leadId = (body?.lead_id ?? body?.leadId) as string | undefined;
    const companyId = (body?.company_id ?? body?.companyId) as string | undefined;
    const ownerEmail = (body?.owner_email ?? body?.ownerEmail) as string | undefined;
    const ownerName = (body?.owner_name ?? body?.ownerName) as string | undefined;
    const companyName = (body?.company_name ?? body?.companyName) as string | undefined;

    if (!companyId || !ownerEmail || !companyName) {
      return jsonResponse(
        { error: "Missing required fields (company_id, owner_email, company_name)" },
        400,
      );
    }

    // 1) Create Auth user with temp password
    const tempPassword = generateTempPassword();

    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email: ownerEmail,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError || !authUser?.user) {
      return jsonResponse(
        { error: authError?.message ?? "Auth create failed" },
        400,
      );
    }

    const userId = authUser.user.id;

    // 2) Insert tenant Admin row into public.users
    const { data: userRow, error: insertError } = await adminClient
      .from("users")
      .insert({
        id: userId,
        company_id: companyId,
        full_name: ownerName || companyName,
        email: ownerEmail,
        phone: null,
        role: "Admin",
        status: "Active",
        created_by: null,
      })
      .select()
      .single();

    if (insertError) {
      await adminClient.auth.admin.deleteUser(userId);
      return jsonResponse({ error: insertError.message }, 400);
    }

    // 3) If called from lead→company conversion, delete the lead record.
    // We don't need to "link" the lead anymore; after conversion the lead is no longer needed.
    let leadDeleted = false;
    let leadDeleteWarning: string | null = null;
    if (leadId) {
      const { data: leadRow, error: leadFetchError } = await adminClient
        .from("leads")
        .select("id")
        .eq("id", leadId)
        .maybeSingle();

      if (leadFetchError) {
        return jsonResponse(
          { error: `Lead lookup failed: ${leadFetchError.message}` },
          500,
        );
      }

      if (!leadRow) {
        // If the lead is already gone, treat as success (idempotent cleanup).
        leadDeleted = true;
      } else {
        const { error: delErr } = await adminClient
          .from("leads")
          .delete()
          .eq("id", leadId);
        if (delErr) {
          leadDeleteWarning = delErr.message;
          return jsonResponse(
            { error: `Lead delete failed: ${delErr.message}` },
            500,
          );
        }
        leadDeleted = true;
      }
    }

    // 4) Send credentials email via Mailtrap (best-effort; do not roll back user)
    const emailResult = await sendMailtrapEmail({
      toEmail: ownerEmail,
      ownerName: ownerName || null,
      companyName,
      tempPassword,
    });

    return jsonResponse({
      success: true,
      user: userRow,
      auth_user_id: userId,
      lead: leadId
        ? { id: leadId, deleted: leadDeleted, warning: leadDeleteWarning }
        : null,
      email: {
        sent: emailResult.sent,
        skipped: emailResult.skipped,
        error: emailResult.error,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Best-effort: write failed activity log for super admins.
    try {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (authHeader.startsWith("Bearer ")) {
        const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user: callerUser } } = await callerClient.auth.getUser();
        if (callerUser) {
          await adminClient.rpc("log_super_admin_activity", {
            p_user_id: callerUser.id,
            p_action_type: "Update",
            p_module_name: "Provision Company Admin",
            p_record_id: null,
            p_description: `Failed: ${msg}`,
            p_status: "Failed",
            p_ip_address: req.headers.get("x-forwarded-for") ?? null,
            p_old_values: null,
            p_new_values: null,
          });
        }
      }
    } catch {
      // never block response
    }
    return jsonResponse({ error: msg }, 500);
  }
});

