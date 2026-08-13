export type ImageUploadKind = "business_logo" | "product_image";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isLocalPreviewUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  return url.startsWith("blob:") || url.startsWith("data:");
}

export function isRemoteImageUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function assertImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Only JPEG, PNG, WebP, and GIF images are allowed";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "Image must be 4 MB or smaller";
  }
  return null;
}

/**
 * Upload a local file to Cloudinary via the app proxy (Android save-time upload).
 * Returns the stored https URL.
 */
export async function uploadImageFile(
  file: File,
  options: { kind: ImageUploadKind; productId?: string | null },
): Promise<string> {
  const validationError = assertImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", options.kind);
  if (options.productId?.trim()) {
    formData.append("productId", options.productId.trim());
  }

  const response = await fetch("/api/uploads/image", {
    method: "POST",
    body: formData,
  });
  const data = (await response.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
  };

  if (!response.ok || !data.url) {
    throw new Error(data.error ?? "Upload failed");
  }

  return data.url;
}

/**
 * Best-effort Cloudinary delete after the DB field was cleared on save
 * (same timing as Android `deleteStoredImage`).
 */
export async function deleteStoredImage(options: {
  kind: ImageUploadKind;
  productId?: string | null;
}): Promise<void> {
  const query = new URLSearchParams({ kind: options.kind });
  if (options.productId?.trim()) {
    query.set("productId", options.productId.trim());
  }

  const response = await fetch(`/api/uploads/image?${query.toString()}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    console.warn(
      "Image delete failed:",
      data.error ?? `status ${response.status}`,
    );
  }
}

/**
 * Resolve form image value for persistence: upload local File if present,
 * pass through remote URLs, reject orphaned blob previews.
 */
export async function resolveImageUrlForSave(options: {
  pendingFile: File | null;
  currentUrl: string | null | undefined;
  kind: ImageUploadKind;
  productId?: string | null;
}): Promise<string | null> {
  if (options.pendingFile) {
    return uploadImageFile(options.pendingFile, {
      kind: options.kind,
      productId: options.productId,
    });
  }

  const current = options.currentUrl?.trim() || null;
  if (!current) return null;

  if (isLocalPreviewUrl(current)) {
    throw new Error("Image preview expired. Please choose the image again.");
  }

  if (!isRemoteImageUrl(current)) {
    throw new Error("Invalid image URL");
  }

  return current;
}
