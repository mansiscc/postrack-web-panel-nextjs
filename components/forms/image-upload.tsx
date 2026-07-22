"use client";

import { Loader2, Upload, X } from "lucide-react";
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
  label?: string;
};

export function ImageUpload({
  value,
  onChange,
  disabled,
  className,
  label = "Drop image or click to upload",
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
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        disabled={disabled || isUploading}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex h-30 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/30 transition-colors",
          !disabled && !isUploading && "hover:bg-muted/50",
        )}
      >
        {value ? (
          <>
            <Image
              src={value}
              alt="Product"
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity hover:opacity-100">
              <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-white">
                Change image
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 text-center text-sm text-muted-foreground">
            {isUploading ? (
              <>
                <Loader2 className="size-6 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="size-6" />
                <span>{label}</span>
                <span className="text-xs">PNG, JPG, WebP up to 5MB</span>
              </>
            )}
          </div>
        )}
      </button>
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
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || isUploading}
          onClick={() => onChange(null)}
        >
          <X />
          Remove image
        </Button>
      ) : null}
    </div>
  );
}
