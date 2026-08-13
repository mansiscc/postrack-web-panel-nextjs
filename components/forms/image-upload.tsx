"use client";

import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  assertImageFile,
  type ImageUploadKind,
} from "@/lib/uploads/client-image";
import { cn } from "@/lib/utils";

export type { ImageUploadKind };

type ImageUploadProps = {
  value?: string | null;
  onChange: (url: string | null) => void;
  /** Local file held until Save (Android content:// equivalent). */
  onPendingFileChange?: (file: File | null) => void;
  /** Matches Android `ImageUploadKind` — used when uploading on Save. */
  kind: ImageUploadKind;
  /** Required when kind is `product_image` (Android contract) at save time. */
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
  onPendingFileChange,
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
  const objectUrlRef = useRef<string | null>(null);

  const revokeObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  useEffect(() => () => revokeObjectUrl(), []);

  // Parent reset / cancel: drop the local preview blob when value changes away.
  useEffect(() => {
    if (objectUrlRef.current && value !== objectUrlRef.current) {
      revokeObjectUrl();
    }
  }, [value]);

  const handleFile = (file: File) => {
    if (kind === "product_image" && !productId?.trim()) {
      toast.error("Product id is required before choosing an image");
      return;
    }

    const validationError = assertImageFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    revokeObjectUrl();
    const previewUrl = URL.createObjectURL(file);
    objectUrlRef.current = previewUrl;
    onPendingFileChange?.(file);
    onChange(previewUrl);
  };

  const handleRemove = () => {
    revokeObjectUrl();
    onPendingFileChange?.(null);
    onChange(null);
  };

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
            <ImageIcon className="size-7" />
            <span className="text-xs">{emptyLabel}</span>
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
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFile(file);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex-1"
        >
          {value ? changeLabel : chooseLabel}
        </Button>
        {value ? (
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={handleRemove}
            className="flex-1"
          >
            {removeLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
