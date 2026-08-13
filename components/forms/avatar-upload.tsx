"use client";

import { ImageIcon, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AvatarUploadProps = {
  value?: string | null;
  onChange: (url: string | null) => void;
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
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleFile = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "business_logo");
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
      toast.success("Logo uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      const response = await fetch(
        "/api/uploads/image?kind=business_logo",
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        console.warn(
          "Logo delete failed:",
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

  const isBanner = layout === "banner";
  const busy = isUploading || isRemoving;

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl bg-surface-variant",
          isBanner ? "aspect-[1.8/1] w-full" : "size-20 rounded-lg border border-border",
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
            {isUploading ? (
              <Loader2 className={isBanner ? "size-7 animate-spin" : "size-6 animate-spin"} />
            ) : (
              <>
                <ImageIcon className={isBanner ? "size-7" : "size-6"} />
                {isBanner ? (
                  <span className="text-xs">{emptyLabel}</span>
                ) : null}
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
          className={isBanner ? "flex-1" : undefined}
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
            className={isBanner ? "flex-1" : undefined}
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
