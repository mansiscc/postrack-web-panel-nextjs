import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function: create-lead
 *
 * Public entrypoint for website / Android demo forms:
 * - Validates payload (email required)
 * - Deduplicates (phone first, then email) within a short window
 * - Inserts into public.leads (service role) — no user/company creation
 * - Sends team notification email (LEAD_NOTIFY_TO)
 * - Sends demo credentials email to the lead (DEMO_LOGIN_EMAIL / DEMO_LOGIN_PASSWORD)
 *
 * Required env (Edge secrets):
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injected when linked)
 * - MAILTRAP_API_KEY, MAIL_FROM_EMAIL
 * - LEAD_NOTIFY_TO
 * - DEMO_LOGIN_EMAIL, DEMO_LOGIN_PASSWORD
 *
 * Optional:
 * - DEMO_COMPANY_NAME, LEAD_NOTIFY_CC, MAIL_FROM_NAME, MAILTRAP_SEND_ENDPOINT
 * - POSTRACK_ADMIN_PANEL_URL, POSTRACK_WEBSITE_URL, POSTRACK_MOBILE_APP_LINK
 * - POSTRACK_EMAIL_LOGO_URL
 */

function envRequired(name: string, value: string | undefined): string {
  const v = value?.trim();
  if (!v) throw new Error(`Missing required Edge secret/env: ${name}`);
  return v;
}

const SUPABASE_URL = envRequired("SUPABASE_URL", Deno.env.get("SUPABASE_URL"));
const SERVICE_ROLE_KEY = envRequired(
  "SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEYS",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEYS"),
);

const MAILTRAP_API_KEY = Deno.env.get("MAILTRAP_API_KEY")?.trim() ?? "";
const MAIL_FROM_EMAIL = Deno.env.get("MAIL_FROM_EMAIL")?.trim() ?? "";
const MAIL_FROM_NAME = Deno.env.get("MAIL_FROM_NAME")?.trim() || "POSTrack";
const MAILTRAP_SEND_ENDPOINT =
  Deno.env.get("MAILTRAP_SEND_ENDPOINT")?.trim() ||
  "https://send.api.mailtrap.io/api/send";

const LEAD_NOTIFY_TO = Deno.env.get("LEAD_NOTIFY_TO")?.trim() ?? "";
const LEAD_NOTIFY_CC = Deno.env.get("LEAD_NOTIFY_CC")?.trim() ?? "";

const POSTRACK_ADMIN_PANEL_URL =
  (Deno.env.get("POSTRACK_ADMIN_PANEL_URL")?.trim() ?? "").replace(/\/+$/, "");
const POSTRACK_WEBSITE_URL = Deno.env.get("POSTRACK_WEBSITE_URL")?.trim() || "https://postrack.in";
const POSTRACK_MOBILE_APP_LINK = Deno.env.get("POSTRACK_MOBILE_APP_LINK")?.trim() ?? "";
const DEMO_LOGIN_EMAIL = Deno.env.get("DEMO_LOGIN_EMAIL")?.trim() ?? "";
const DEMO_LOGIN_PASSWORD = Deno.env.get("DEMO_LOGIN_PASSWORD")?.trim() ?? "";
const DEMO_COMPANY_NAME = Deno.env.get("DEMO_COMPANY_NAME")?.trim() || "POSTrack Demo";

const SUCCESS_MESSAGE =
  "Demo login details have been sent to your email. Please check your inbox and spam folder.";

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

const MAX_BODY_BYTES = 8_000;
const DEDUP_WINDOW_SECONDS = 60;
const phoneRegex = /^[6-9]\d{9}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// NOTE: Supabase CLI bundles only files inside the function folder by default.
// Keep helper logic in this file to avoid cross-folder imports breaking deploy.
const ALLOWED_LEAD_SOURCES = new Set([
  "website",
  "android-login-contact",
  "instagram",
  "facebook",
  "whatsapp",
  "youtube",
  "linkedin",
  "twitter",
  "telegram",
  "pinterest",
  "snapchat",
  "threads",
  "tiktok",
  "google-ads",
  "referral-customer",
  "referral-partner",
  "phone-call",
  "walk-in",
  "event",
  "email-campaign",
  "other",
]);

const SOURCES_REQUIRING_DETAIL = new Set([
  "other",
  "referral-customer",
  "referral-partner",
]);

function normalizeLeadSource(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (!v) return "other";
  return ALLOWED_LEAD_SOURCES.has(v) ? v : "other";
}

function postrackEmailLogoUrl(): string {
  const explicit = Deno.env.get("POSTRACK_EMAIL_LOGO_URL")?.trim();
  if (explicit) return explicit;
  const adminBase = Deno.env.get("POSTRACK_ADMIN_PANEL_URL")?.trim().replace(/\/+$/, "");
  if (adminBase) return `${adminBase}/assets/images/postrack-logo-full.png`;
  return "";
}

function lucideSvg(
  paths: string,
  opts?: { stroke?: string; size?: number; margin?: string },
): string {
  const stroke = opts?.stroke ?? "#be123c";
  const size = opts?.size ?? 18;
  const margin = opts?.margin ?? "margin-right:6px;";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-hidden="true" style="display:inline-block;vertical-align:-4px;${margin}">${paths}</svg>`;
}

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
const LUCIDE_SMARTPHONE =
  `<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>`;

function buildDemoCredentialsEmail(params: {
  contactName: string;
  companyName: string;
  loginEmail: string;
  loginPassword: string;
  websiteLink: string;
  includeMobileAppLink: boolean;
  mobileAppLink: string;
}): { subject: string; text: string; html: string } {
  const greetingName = params.contactName.trim() || "there";
  const companyName = params.companyName.trim() || "POSTrack Demo";
  const { loginEmail, loginPassword, includeMobileAppLink } = params;
  const websiteLink = params.websiteLink.trim();
  const mobileAppLink = params.mobileAppLink.trim();

  const subject = "Your POSTrack demo login details";

  const mobilePlain = includeMobileAppLink
    ? [
        "---",
        "",
        "Access",
        "",
        "Mobile App (Google Play):",
        mobileAppLink || "—",
        "",
      ]
    : [];

  const plainText = [
    `Hello ${greetingName},`,
    "",
    "Thank you for requesting a POSTrack demo.",
    "",
    "Use the credentials below to explore the app. This is a shared demo account for evaluation only.",
    "",
    "---",
    "",
    "Demo Login Credentials",
    "",
    `Login Email: ${loginEmail}`,
    `Password: ${loginPassword}`,
    "",
    "Sign in with the POSTrack Android app using the email and password above.",
    "",
    ...mobilePlain,
    "---",
    "",
    "What you can try in the demo",
    "",
    "• Billing & invoice management",
    "• Inventory tracking",
    "• Sales & reports",
    "• Staff management",
    "",
    ...(websiteLink ? ["Website:", websiteLink, ""] : []),
    "If you did not request this email, you can ignore it.",
    "",
    "Best regards,",
    "POSTrack Team",
  ].join("\n");

  const logoUrl = postrackEmailLogoUrl();
  const headingIconStroke = "#111827";

  const mobileHtml = includeMobileAppLink
    ? `<p style="margin:0; font-size:13.5px;"><strong>${lucideSvg(LUCIDE_SMARTPHONE, { stroke: headingIconStroke })}Mobile App (Google Play):</strong><br/>
              ${
                mobileAppLink
                  ? `<a href="${mobileAppLink.replace(/"/g, "&quot;")}" style="color:#2563eb; text-decoration:none;">${mobileAppLink}</a>`
                  : "—"
              }
            </p>`
    : "";

  const accessSectionHtml = includeMobileAppLink
    ? `
      <tr>
        <td style="padding:16px 26px 6px 26px;">
          <h2 style="margin:0; font-size:15px; font-weight:900;">${lucideSvg(LUCIDE_GLOBE, { stroke: headingIconStroke })}Access</h2>
          <div style="margin-top:10px; padding:14px; border:1px solid #e5e7eb; border-radius:12px;">
            ${mobileHtml}
          </div>
        </td>
      </tr>`
    : "";

  const websiteHtml = websiteLink
    ? `<div style="margin-top:16px; padding:14px; border:1px solid #e5e7eb; border-radius:12px; background:#fafafa;">
            <p style="margin:0 0 6px 0; font-size:13.5px;"><strong>${lucideSvg(LUCIDE_GLOBE, { stroke: headingIconStroke })}Website:</strong></p>
            <a href="${websiteLink.replace(/"/g, "&quot;")}" style="color:#2563eb; text-decoration:none; font-size:13.5px; word-break:break-all;">${websiteLink}</a>
          </div>`
    : "";

  const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0; padding:24px; background:#f9fafb; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#111827;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:14px; border:1px solid #e5e7eb; overflow:hidden;">
      <tr>
        <td style="padding:22px 26px 10px 26px; background: linear-gradient(135deg, #fdf2f8 0%, #fff7ed 100%); border-bottom:1px solid #e5e7eb;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="vertical-align:top;">
                <h1 style="margin:0; font-size:20px; font-weight:800; letter-spacing:-0.02em;">
                  Your <span style="color:#be123c;">POSTrack</span> demo
                  ${lucideSvg(LUCIDE_PARTY_POPPER, { stroke: "#be123c", size: 20, margin: "margin-left:6px;margin-right:0;" })}
                </h1>
                <p style="margin:10px 0 0 0; font-size:14px; color:#374151;">Hello ${greetingName},</p>
                <p style="margin:8px 0 0 0; font-size:14px; color:#4b5563;">
                  Thank you for your interest. Use the demo credentials below to sign in and explore POSTrack.
                </p>
              </td>
              <td align="right" valign="top" width="1%" style="padding-left:12px;white-space:nowrap;">
                ${
                  logoUrl
                    ? `<img src="${logoUrl.replace(/"/g, "&quot;")}" alt="POSTrack" width="132" style="display:block;max-width:132px;width:132px;height:auto;border:0;" />`
                    : ""
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:18px 26px 6px 26px;">
          <h2 style="margin:0; font-size:15px; font-weight:900;">${lucideSvg(LUCIDE_LOCK_KEYHOLE, { stroke: headingIconStroke })}Demo login credentials</h2>
          <div style="margin-top:10px; padding:14px; border:1px solid #e5e7eb; border-radius:12px; background:#fafafa;">
            <p style="margin:0 0 8px 0; font-size:13.5px;"><strong>Login email:</strong> ${loginEmail}</p>
            <p style="margin:0; font-size:13.5px;"><strong>Password:</strong> <span style="color:#b91c1c; font-weight:800;">${loginPassword}</span></p>
          </div>
          <p style="margin:12px 0 0 0; font-size:13px; color:#4b5563;">
            ${lucideSvg(LUCIDE_MOUSE_POINTER, { stroke: "#6b7280", size: 16, margin: "margin-right:8px;" })}
            Open the POSTrack app on your device and sign in with the email and password above.
          </p>
        </td>
      </tr>
${accessSectionHtml}

      <tr>
        <td style="padding:16px 26px 6px 26px;">
          <div style="margin-top:16px;">
            <h2 style="margin:0; font-size:15px; font-weight:900;">${lucideSvg(LUCIDE_ROCKET, { stroke: headingIconStroke })}What you can try</h2>
            <ul style="margin:10px 0 0 18px; padding:0; font-size:13.5px; color:#374151; line-height:1.55;">
              <li>Billing &amp; invoice management</li>
              <li>Inventory tracking</li>
              <li>Sales &amp; reports dashboard</li>
              <li>Staff management</li>
            </ul>
          </div>
          ${websiteHtml}

          <p style="margin:18px 0 0 0; font-size:13px; color:#6b7280;">
            If you did not request this demo, you can safely ignore this email.
          </p>
          <p style="margin:12px 0 0 0; font-size:13.5px; color:#111827;">
            Best regards,<br/><strong>POSTrack Team</strong>
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

  return { subject, text: plainText, html };
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function buildAdminPanelLink(): string {
  return POSTRACK_ADMIN_PANEL_URL;
}

function validateLead(raw: unknown) {
  const fullName = normalizeString((raw as any)?.fullName);
  const phone = normalizeString((raw as any)?.phone);
  const email = normalizeString((raw as any)?.email).toLowerCase();
  const businessName = normalizeString((raw as any)?.businessName);
  const category = normalizeString((raw as any)?.category);
  const message = normalizeString((raw as any)?.message);
  const source = normalizeString((raw as any)?.source);
  const sourceDetail = normalizeString((raw as any)?.sourceDetail);
  const platform = normalizeString((raw as any)?.platform);

  const errors: Record<string, string[]> = {};

  if (!fullName || fullName.length < 2) errors.fullName = ["Name must be at least 2 characters"];
  else if (fullName.length > 80) errors.fullName = ["Name is too long"];

  if (!phoneRegex.test(phone)) errors.phone = ["Enter a valid 10-digit mobile number"];

  if (!email) errors.email = ["Email address is required"];
  else if (!emailRegex.test(email)) errors.email = ["Enter a valid email address"];
  else if (email.length > 254) errors.email = ["Email is too long"];

  if (!businessName || businessName.length < 2) errors.businessName = ["Business name must be at least 2 characters"];
  else if (businessName.length > 100) errors.businessName = ["Business name is too long"];

  if (category && category.length > 100) errors.category = ["Category is too long"];
  if (message && message.length > 500) errors.message = ["Message is too long"];
  if (source && source.length > 100) errors.source = ["Source is too long"];
  if (platform && platform.length > 50) errors.platform = ["Platform is too long"];

  const normalizedSource = normalizeLeadSource(source);
  const normalizedPlatform = platform.trim().toLowerCase();

  if (SOURCES_REQUIRING_DETAIL.has(normalizedSource)) {
    if (!sourceDetail || sourceDetail.length < 2) {
      errors.sourceDetail = ["Please enter a name or description (at least 2 characters)"];
    } else if (sourceDetail.length > 100) {
      errors.sourceDetail = ["Source detail is too long"];
    }
  } else if (sourceDetail.length > 100) {
    errors.sourceDetail = ["Source detail is too long"];
  }

  const ok = Object.keys(errors).length === 0;
  const normalizedSourceDetail = SOURCES_REQUIRING_DETAIL.has(normalizedSource) ? sourceDetail : "";

  return {
    ok,
    errors,
    data: {
      fullName,
      phone,
      email,
      businessName,
      category: category || "",
      message: message || "",
      source: normalizedSource,
      sourceDetail: normalizedSourceDetail,
      platform: normalizedPlatform,
    },
  };
}

function splitEmails(list: string): string[] {
  return list
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatSubmittedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;

    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .reduce<Record<string, string>>((acc, p) => {
        if (p.type !== "literal") acc[p.type] = p.value;
        return acc;
      }, {});

    const y = parts.year ?? "";
    const m = parts.month ?? "";
    const day = parts.day ?? "";
    const hh = parts.hour ?? "";
    const mm = parts.minute ?? "";
    const ss = parts.second ?? "";

    if (![y, m, day, hh, mm, ss].every(Boolean)) return iso;

    // Example: 2026-05-27 16:34:33 IST
    return `${y}-${m}-${day} ${hh}:${mm}:${ss} IST`;
  } catch {
    return iso;
  }
}

function escapeForText(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function buildInquiryMailText(args: {
  submittedAt: string;
  fullName: string;
  phone: string;
  email: string;
  businessName: string;
  category: string;
  message: string;
  source: string;
  sourceDetail: string;
  platform: string;
  ip: string;
  adminPanelLink: string;
}): string {
  const emailOrDash = args.email ? args.email : "-";
  const categoryOrDash = args.category ? args.category : "-";
  const messageOrDash = args.message ? args.message : "-";
  const sourceOrDash = args.source ? args.source : "-";
  const sourceDetailOrDash = args.sourceDetail ? args.sourceDetail : "-";
  const platformOrDash = args.platform ? args.platform : "-";
  const ipOptional = args.ip && args.ip !== "unknown" ? `IP: ${args.ip}` : "";
  const adminPanelLink = args.adminPanelLink || "-";

  return escapeForText(
    `Hello Team,

A new demo request has been submitted and requires follow-up from the sales/onboarding team.

Submitted At: ${args.submittedAt}

Full Name: ${args.fullName}
Phone Number: ${args.phone}
Email Address: ${emailOrDash}

Business Name: ${args.businessName}
Business Category: ${categoryOrDash}

Message:
${messageOrDash}

Platform: ${platformOrDash}
Source: ${sourceOrDash}
Source detail: ${sourceDetailOrDash}
${ipOptional}

Please review this lead in the Admin Panel and follow up with the customer at the earliest convenience.

Admin Panel:
${adminPanelLink}

Best Regards,
POSTrack Team`,
  );
}

function buildInquiryMailHtml(textBody: string): string {
  // Simple, robust HTML: preserve newlines with <br/>.
  const escaped = textBody
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.55;white-space:normal;">${
    escaped.replace(/\n/g, "<br/>")
  }</div>`;
}

async function sendMailtrapEmail(params: {
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  html: string;
}): Promise<{ sent: boolean; skipped: boolean; error: string | null }> {
  if (!MAILTRAP_API_KEY || !MAIL_FROM_EMAIL) {
    return { sent: false, skipped: true, error: "Mailtrap not configured" };
  }

  const to = params.to.map((e) => e.trim()).filter(Boolean);
  if (to.length === 0) {
    return { sent: false, skipped: true, error: "No recipients" };
  }
  const cc = (params.cc ?? []).map((e) => e.trim()).filter(Boolean);

  const payload = {
    from: { email: MAIL_FROM_EMAIL, name: MAIL_FROM_NAME },
    to: to.map((email) => ({ email })),
    ...(cc.length ? { cc: cc.map((email) => ({ email })) } : {}),
    subject: params.subject,
    text: params.text,
    html: params.html,
  };

  try {
    const res = await fetch(MAILTRAP_SEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MAILTRAP_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      return {
        sent: false,
        skipped: false,
        error: raw?.trim()
          ? `Mailtrap error (${res.status}): ${raw.slice(0, 800)}`
          : `Mailtrap error (${res.status})`,
      };
    }

    return { sent: true, skipped: false, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { sent: false, skipped: false, error: msg };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, message: "Method not allowed" }, 405);

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse(
      { success: false, code: "PAYLOAD", message: "The form submission was too large. Remove long text and try again." },
      413,
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonResponse(
      { success: false, code: "PAYLOAD", message: "This page sent an invalid request format. Please refresh and try again." },
      415,
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse(
      { success: false, code: "PAYLOAD", message: "The request body was not valid. Please refresh the page and try again." },
      400,
    );
  }

  const parsed = validateLead(raw);
  if (!parsed.ok) {
    return jsonResponse(
      {
        success: false,
        code: "VALIDATION",
        message: "Please correct the highlighted fields and try again.",
        errors: parsed.errors,
      },
      400,
    );
  }

  const { fullName, phone, email, businessName, category, message, source, sourceDetail, platform } = parsed.data;

  // De-dup: phone first; if not found, then email (when provided), within a short window.
  const sinceIso = new Date(Date.now() - DEDUP_WINDOW_SECONDS * 1000).toISOString();
  try {
    // 1) phone
    const { data: existingByPhone, error: phoneErr } = await adminClient
      .from("leads")
      .select("id,created_at")
      .gte("created_at", sinceIso)
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (phoneErr) {
      return jsonResponse(
        {
          success: false,
          code: "DATABASE",
          message: "We could not save your request. Please try again in a few minutes.",
          details: `${phoneErr.code ?? "?"}: ${phoneErr.message}`,
        },
        500,
      );
    }

    if (existingByPhone?.id) {
      return jsonResponse(
        {
          success: true,
          message: SUCCESS_MESSAGE,
          id: existingByPhone.id,
          dedup: { by: "phone", windowSeconds: DEDUP_WINDOW_SECONDS },
        },
        200,
      );
    }

    // 2) email
    if (email) {
      const { data: existingByEmail, error: emailErr } = await adminClient
        .from("leads")
        .select("id,created_at")
        .gte("created_at", sinceIso)
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (emailErr) {
        return jsonResponse(
          {
            success: false,
            code: "DATABASE",
            message: "We could not save your request. Please try again in a few minutes.",
            details: `${emailErr.code ?? "?"}: ${emailErr.message}`,
          },
          500,
        );
      }

      if (existingByEmail?.id) {
        return jsonResponse(
          {
            success: true,
            message: SUCCESS_MESSAGE,
            id: existingByEmail.id,
            dedup: { by: "email", windowSeconds: DEDUP_WINDOW_SECONDS },
          },
          200,
        );
      }
    }

    // Insert lead
    const { data: inserted, error: insertErr } = await adminClient
      .from("leads")
      .insert([
        {
          contact_name: fullName,
          phone,
          email,
          business_name: businessName,
          business_category: category || null,
          message: message || null,
          source: source || "other",
          source_detail: sourceDetail || null,
          platform: platform || null,
          status: "New",
        },
      ])
      .select("id,created_at")
      .single();

    if (insertErr) {
      return jsonResponse(
        {
          success: false,
          code: "DATABASE",
          message: "We could not save your request. Please try again in a few minutes.",
          details: `${insertErr.code ?? "?"}: ${insertErr.message}`,
        },
        500,
      );
    }

    const leadId = inserted?.id as string;
    const submittedAtIso =
      typeof inserted?.created_at === "string"
        ? inserted.created_at
        : new Date().toISOString();
    const submittedAt = formatSubmittedAt(submittedAtIso);

    const ip = getClientIp(req);
    const adminPanelLink = buildAdminPanelLink();

    const subject = `New Demo Request — ${businessName} (${fullName})`;
    const text = buildInquiryMailText({
      submittedAt,
      fullName,
      phone,
      email,
      businessName,
      category,
      message,
      source,
      sourceDetail,
      platform,
      ip,
      adminPanelLink,
    });
    const html = buildInquiryMailHtml(text);

    const teamEmailResult = await sendMailtrapEmail({
      to: splitEmails(LEAD_NOTIFY_TO),
      cc: splitEmails(LEAD_NOTIFY_CC),
      subject,
      text,
      html,
    });

    if (!DEMO_LOGIN_EMAIL || !DEMO_LOGIN_PASSWORD) {
      return jsonResponse(
        {
          success: false,
          code: "CONFIG",
          message: "Demo login is temporarily unavailable. Please try again later or contact support.",
          id: leadId,
        },
        503,
      );
    }

    // Include Play Store link for non-Android submissions (web + admin).
    const includeMobileAppLink = platform !== "android";
    const demoMail = buildDemoCredentialsEmail({
      contactName: fullName,
      companyName: DEMO_COMPANY_NAME,
      loginEmail: DEMO_LOGIN_EMAIL,
      loginPassword: DEMO_LOGIN_PASSWORD,
      includeMobileAppLink,
      websiteLink: POSTRACK_WEBSITE_URL,
      mobileAppLink: POSTRACK_MOBILE_APP_LINK,
    });

    const leadEmailResult = await sendMailtrapEmail({
      to: [email],
      subject: demoMail.subject,
      text: demoMail.text,
      html: demoMail.html,
    });

    if (!leadEmailResult.sent) {
      return jsonResponse(
        {
          success: false,
          code: "EMAIL",
          message:
            "Your request was saved, but we could not send the demo email. Please contact support@postrack.in.",
          id: leadId,
          email: { team: teamEmailResult, lead: leadEmailResult },
        },
        503,
      );
    }

    return jsonResponse(
      {
        success: true,
        message: SUCCESS_MESSAGE,
        id: leadId,
        email: { team: teamEmailResult, lead: leadEmailResult },
      },
      201,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse(
      {
        success: false,
        code: "UNKNOWN",
        message: "Something unexpected went wrong. Please try again later.",
        details: msg,
      },
      500,
    );
  }
});

