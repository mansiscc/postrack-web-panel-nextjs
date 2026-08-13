import { NextResponse } from "next/server";

import { getAdminOrManagerUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

/** Match Android `CloudinaryUploadRemoteDataSource.MAX_BYTES` (4 MB). */
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
]);
const UPLOAD_KINDS = new Set(["business_logo", "product_image"]);

function getFileExtension(filename: string): string {
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index).toLowerCase() : "";
}

function getUploadApiBaseUrl(): string | null {
  const base = process.env.UPLOAD_API_BASE_URL?.trim().replace(/\/+$/, "");
  return base || null;
}

/** A base URL pointing back at this app would proxy to itself instead of the admin. */
function isSelfReference(baseUrl: string, request: Request): boolean {
  try {
    return new URL(baseUrl).host === request.headers.get("host");
  } catch {
    return false;
  }
}

async function callAdminApi(
  url: string,
  init: RequestInit,
): Promise<Response | { unreachable: string }> {
  try {
    return await fetch(url, init);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[uploads/image] cannot reach admin upload API: ${url}`, error);
    return { unreachable: detail };
  }
}

async function getAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token?.trim() || null;
}

type AdminUploadPayload = {
  publicUrl?: string;
  url?: string;
  error?: string;
};

/**
 * Proxies image upload/delete to the admin panel signed Cloudinary API
 * (same contract as Android `CloudinaryUploadRemoteDataSource`):
 * - POST  {UPLOAD_API_BASE_URL}/api/uploads/image
 * - DELETE {UPLOAD_API_BASE_URL}/api/uploads/image?kind=&companyId=&productId=
 * Cloudinary secrets stay on the admin server — never in this app.
 */
export async function POST(request: Request) {
  try {
    const user = await getAdminOrManagerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const baseUrl = getUploadApiBaseUrl();
    if (!baseUrl) {
      return NextResponse.json(
        { error: "Image upload is not configured (UPLOAD_API_BASE_URL)" },
        { status: 503 },
      );
    }

    if (isSelfReference(baseUrl, request)) {
      return NextResponse.json(
        { error: "UPLOAD_API_BASE_URL points at this app, not the admin panel" },
        { status: 503 },
      );
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const kind = String(formData.get("kind") ?? "").trim();
    const productId = String(formData.get("productId") ?? "").trim() || null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!UPLOAD_KINDS.has(kind)) {
      return NextResponse.json(
        { error: "Invalid upload kind" },
        { status: 400 },
      );
    }

    if (kind === "product_image" && !productId) {
      return NextResponse.json(
        { error: "Product id is required for product images" },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, and GIF images are allowed" },
        { status: 400 },
      );
    }

    const extension = getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { error: "Invalid file extension" },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image must be 4 MB or smaller" },
        { status: 400 },
      );
    }

    // companyId always from session (do not trust client), matching Android intent.
    const forward = new FormData();
    forward.append("file", file);
    forward.append("kind", kind);
    forward.append("companyId", user.companyId);
    if (productId) {
      forward.append("productId", productId);
    }

    const adminResponse = await callAdminApi(`${baseUrl}/api/uploads/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: forward,
    });

    if ("unreachable" in adminResponse) {
      return NextResponse.json(
        { error: `Cannot reach upload service at ${baseUrl}` },
        { status: 502 },
      );
    }

    const payload = (await adminResponse.json().catch(() => ({}))) as AdminUploadPayload;
    const publicUrl =
      payload.publicUrl?.trim() || payload.url?.trim() || null;

    if (!adminResponse.ok || !publicUrl) {
      console.error(
        `[uploads/image] admin upload rejected (${adminResponse.status})`,
        payload,
      );
      return NextResponse.json(
        {
          error:
            payload.error?.trim() ||
            `Image upload failed (${adminResponse.status})`,
        },
        { status: adminResponse.status >= 400 ? adminResponse.status : 400 },
      );
    }

    // Web UI expects `{ url }`; Android expects `{ publicUrl }`.
    return NextResponse.json({ url: publicUrl, publicUrl });
  } catch (error) {
    console.error("[uploads/image] upload failed", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAdminOrManagerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const baseUrl = getUploadApiBaseUrl();
    if (!baseUrl) {
      return NextResponse.json(
        { error: "Image upload is not configured (UPLOAD_API_BASE_URL)" },
        { status: 503 },
      );
    }

    if (isSelfReference(baseUrl, request)) {
      return NextResponse.json(
        { error: "UPLOAD_API_BASE_URL points at this app, not the admin panel" },
        { status: 503 },
      );
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind")?.trim() ?? "";
    const productId = searchParams.get("productId")?.trim() || null;

    if (!UPLOAD_KINDS.has(kind)) {
      return NextResponse.json(
        { error: "Invalid upload kind" },
        { status: 400 },
      );
    }

    if (kind === "product_image" && !productId) {
      return NextResponse.json(
        { error: "Product id is required for product images" },
        { status: 400 },
      );
    }

    const query = new URLSearchParams({
      kind,
      companyId: user.companyId,
    });
    if (productId) {
      query.set("productId", productId);
    }

    const adminResponse = await callAdminApi(
      `${baseUrl}/api/uploads/image?${query.toString()}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if ("unreachable" in adminResponse) {
      return NextResponse.json(
        { error: `Cannot reach upload service at ${baseUrl}` },
        { status: 502 },
      );
    }

    if (!adminResponse.ok) {
      const payload = (await adminResponse
        .json()
        .catch(() => ({}))) as AdminUploadPayload;
      return NextResponse.json(
        {
          error:
            payload.error?.trim() ||
            `Image delete failed (${adminResponse.status})`,
        },
        { status: adminResponse.status >= 400 ? adminResponse.status : 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[uploads/image] delete failed", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
