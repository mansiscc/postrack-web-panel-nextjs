"use client";

import { Loader2, Upload } from "lucide-react";
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
};

export function AvatarUpload({
  value,
  onChange,
  disabled,
  className,
}: AvatarUploadProps) {
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
      toast.success("Logo uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative flex size-20 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
        {value ? (
          <Image
            src={value}
            alt="Business logo"
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <Upload className="size-6 text-muted-foreground" />
        )}
      </div>
      <div className="space-y-2">
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
        >
          {isUploading ? (
            <>
              <Loader2 className="animate-spin" />
              Uploading…
            </>
          ) : (
            "Upload logo"
          )}
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || isUploading}
            onClick={() => onChange(null)}
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}
