"use client";

import { ImageIcon, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ImageUploadProps = {
  value?: string | null;
  onChange: (url: string | null) => void;
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

  const handleFile = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
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
          disabled={disabled || isUploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || isUploading}
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
            disabled={disabled || isUploading}
            onClick={() => onChange(null)}
            className="flex-1"
          >
            {removeLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
