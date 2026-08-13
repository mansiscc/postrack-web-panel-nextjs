"use client";

import { ImageIcon, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ImageUploadKind = "business_logo" | "product_image";

type ImageUploadProps = {
  value?: string | null;
  onChange: (url: string | null) => void;
  /** Matches Android `ImageUploadKind` — required by admin upload API. */
  kind: ImageUploadKind;
  /** Required when kind is `product_image` (Android contract). */
  productId?: string | null;
  disabled?: boolean;
  className?: string;
  emptyLabel?: string;
  chooseLabel?: string;
  changeLabel?: string;
  removeLabel?: string;
  helpText?: string;
};

export function ImageUpload({
  value,
  onChange,
  kind,
  productId,
  disabled,
  className,
  emptyLabel = "No image selected",
  chooseLabel = "Choose Image",
  changeLabel = "Change Image",
  removeLabel = "Remove Image",
  helpText,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleFile = async (file: File) => {
    if (kind === "product_image" && !productId?.trim()) {
      toast.error("Product id is required before uploading an image");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);
      if (productId?.trim()) {
        formData.append("productId", productId.trim());
      }
      const response = await fetch("/api/uploads/image", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      onChange(data.url);
      toast.success("Image uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      // Best-effort Cloudinary delete (same as Android after clearing the image).
      if (kind === "product_image" && !productId?.trim()) {
        onChange(null);
        return;
      }

      const query = new URLSearchParams({ kind });
      if (productId?.trim()) {
        query.set("productId", productId.trim());
      }
      const response = await fetch(`/api/uploads/image?${query.toString()}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        // Still clear local preview; admin may already have no asset.
        console.warn(
          "Image delete failed:",
          data.error ?? `status ${response.status}`,
        );
      }
      onChange(null);
    } catch {
      onChange(null);
    } finally {
      setIsRemoving(false);
    }
  };

  const busy = isUploading || isRemoving;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl bg-surface-variant">
        {value ? (
          <Image
            src={value}
            alt="Product"
            fill
            className="object-contain p-3"
            unoptimized
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
            {isUploading ? (
              <Loader2 className="size-7 animate-spin" />
            ) : (
              <>
                <ImageIcon className="size-7" />
                <span className="text-xs">{emptyLabel}</span>
              </>
            )}
          </div>
        )}
      </div>

      {helpText ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {helpText}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          disabled={disabled || busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className="flex-1"
        >
          {isUploading ? (
            <>
              <Loader2 className="animate-spin" />
              Uploading…
            </>
          ) : value ? (
            changeLabel
          ) : (
            chooseLabel
          )}
        </Button>
        {value ? (
          <Button
            type="button"
            variant="outline"
            disabled={disabled || busy}
            onClick={() => void handleRemove()}
            className="flex-1"
          >
            {isRemoving ? (
              <>
                <Loader2 className="animate-spin" />
                Removing…
              </>
            ) : (
              removeLabel
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
