import crypto from "crypto";

import { NextResponse } from "next/server";

import { getAdminOrManagerUser } from "@/lib/auth/guards";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
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

function getFileExtension(filename: string): string {
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index).toLowerCase() : "";
}

export async function POST(request: Request) {
  try {
    const user = await getAdminOrManagerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Image upload is not configured" },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
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
        { error: "File must be 5MB or smaller" },
        { status: 400 },
      );
    }

    const timestamp = Math.round(Date.now() / 1000);
    const folder = `postrack/${user.companyId}`;
    const paramsToSign = {
      folder,
      timestamp: String(timestamp),
    };

    const signatureBase = Object.keys(paramsToSign)
      .sort()
      .map((key) => `${key}=${paramsToSign[key as keyof typeof paramsToSign]}`)
      .join("&");

    const signature = crypto
      .createHash("sha1")
      .update(`${signatureBase}${apiSecret}`)
      .digest("hex");

    const uploadForm = new FormData();
    uploadForm.append("file", file);
    uploadForm.append("api_key", apiKey);
    uploadForm.append("timestamp", String(timestamp));
    uploadForm.append("folder", folder);
    uploadForm.append("signature", signature);

    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: uploadForm },
    );

    const payload = (await cloudinaryResponse.json()) as {
      secure_url?: string;
      error?: { message?: string };
    };

    if (!cloudinaryResponse.ok || !payload.secure_url) {
      return NextResponse.json(
        { error: payload.error?.message ?? "Upload failed" },
        { status: 400 },
      );
    }

    return NextResponse.json({ url: payload.secure_url });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}
