"use client";

import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { assertImageFile } from "@/lib/uploads/client-image";
import { cn } from "@/lib/utils";

type AvatarUploadProps = {
  value?: string | null;
  onChange: (url: string | null) => void;
  /** Local file held until Save (Android content:// equivalent). */
  onPendingFileChange?: (file: File | null) => void;
  disabled?: boolean;
  className?: string;
  layout?: "avatar" | "banner";
  emptyLabel?: string;
  chooseLabel?: string;
  changeLabel?: string;
  removeLabel?: string;
  helpText?: string;
};

export function AvatarUpload({
  value,
  onChange,
  onPendingFileChange,
  disabled,
  className,
  layout = "avatar",
  emptyLabel = "No logo selected",
  chooseLabel = "Choose Logo",
  changeLabel = "Change Logo",
  removeLabel = "Remove Logo",
  helpText,
}: AvatarUploadProps) {
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

  const isBanner = layout === "banner";

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl bg-surface-variant",
          isBanner
            ? "aspect-[1.8/1] w-full"
            : "size-20 rounded-lg border border-border",
        )}
      >
        {value ? (
          <Image
            src={value}
            alt="Business logo"
            fill
            className={isBanner ? "object-contain p-3" : "object-cover"}
            unoptimized
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageIcon className={isBanner ? "size-7" : "size-6"} />
            {isBanner ? <span className="text-xs">{emptyLabel}</span> : null}
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
          className={isBanner ? "flex-1" : undefined}
        >
          {value ? changeLabel : chooseLabel}
        </Button>
        {value ? (
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={handleRemove}
            className={isBanner ? "flex-1" : undefined}
          >
            {removeLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
