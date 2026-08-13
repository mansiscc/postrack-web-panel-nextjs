"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Minus,
  Plus,
  Printer,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { QrLabelSheetPreview } from "@/components/labels/qr-label-sheet-preview";
import { useTopbarChrome } from "@/components/layout/topbar-chrome";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  expandItemsToLabels,
  type LabelPrintSourceItem,
} from "@/utils/label-print";
import {
  printQrStickers,
  shareQrStickers,
} from "@/utils/print-product-qr-labels";
import { getQrLabelLayoutConfig } from "@/utils/qr-label-layout";
import {
  DEFAULT_QR_LABEL_PREFERENCES,
  labelSizeDisplay,
  QR_LABEL_MAX_FIXED_COPIES,
  readQrLabelPreferences,
  writeQrLabelPreferences,
  type QrLabelPreferences,
  type QrLabelSize,
  type QrLabelTextSize,
} from "@/utils/qr-label-preferences";

type LabelPrintViewProps = {
  items: LabelPrintSourceItem[];
  title?: string;
  backHref?: string;
};

const TEXT_SIZES: { id: QrLabelTextSize; label: string }[] = [
  { id: "SMALL", label: "S" },
  { id: "MEDIUM", label: "M" },
  { id: "LARGE", label: "L" },
];

function SettingRow({
  label,
  description,
  control,
  className,
}: {
  label: string;
  description?: string;
  control: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-2",
        className,
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-[13px] font-medium text-foreground">{label}</p>
        {description ? (
          <p className="text-[11px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function SegmentedChoices({
  value,
  onChange,
  disabled,
}: {
  value: QrLabelTextSize;
  onChange: (value: QrLabelTextSize) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex w-full gap-1 rounded-lg bg-muted p-1">
      {TEXT_SIZES.map((size) => {
        const selected = value === size.id;
        return (
          <button
            key={size.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(size.id)}
            className={cn(
              "flex-1 rounded-md py-1.5 text-[12px] font-medium transition-colors",
              selected
                ? "bg-primary font-bold text-primary-foreground"
                : "text-foreground hover:bg-background/60",
              disabled && "opacity-50",
            )}
            aria-pressed={selected}
          >
            {size.label}
          </button>
        );
      })}
    </div>
  );
}

export function LabelPrintView({
  items,
  title = "Print QR Labels",
  backHref = "/purchases",
}: LabelPrintViewProps) {
  const { setChrome, clearChrome } = useTopbarChrome();
  const [preferences, setPreferences] = useState<QrLabelPreferences>(
    DEFAULT_QR_LABEL_PREFERENCES,
  );
  const [hydrated, setHydrated] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setPreferences(readQrLabelPreferences());
    setHydrated(true);
    document.title = title;
  }, [title]);

  const patchPreferences = (patch: Partial<QrLabelPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...patch };
      writeQrLabelPreferences(next);
      return next;
    });
  };

  const expanded = useMemo(
    () => expandItemsToLabels(items, preferences),
    [items, preferences],
  );

  const layout = useMemo(
    () => getQrLabelLayoutConfig(preferences.labelSize),
    [preferences.labelSize],
  );

  const hasAnyBarcode = expanded.models.length > 0;
  const itemCount = items.length;
  const stickerCount = expanded.totalStickers;
  const subtitle = itemCount === 1 ? "1 label" : `${itemCount} labels`;
  const previewScale = preferences.labelSize === "SMALL" ? 1.1 : 1.15;

  const handlePrint = async () => {
    setPrintError(null);
    if (!hasAnyBarcode) {
      setPrintError(
        "No stickers to print. Add barcodes to products first.",
      );
      return;
    }
    setIsBusy(true);
    try {
      const printed = await printQrStickers(expanded.models, preferences);
      toast.success(
        expanded.skippedNoBarcode.length > 0
          ? `Printed ${printed} sticker(s). Skipped ${expanded.skippedNoBarcode.length} (no barcode).`
          : `Printed ${printed} sticker(s)`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Print failed.";
      setPrintError(message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleShare = async () => {
    if (!hasAnyBarcode) {
      toast.error("No stickers to share. Add barcodes to products first.");
      return;
    }
    setIsBusy(true);
    try {
      await shareQrStickers(expanded.models, preferences);
      toast.success("QR labels ready to share.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not share QR labels.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    setChrome({
      title,
      subtitle,
      leading: (
        <Button type="button" variant="ghost" size="icon-sm" asChild>
          <Link href={backHref} aria-label="Back to purchases">
            <ArrowLeft />
          </Link>
        </Button>
      ),
      actions: (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-primary text-primary hover:bg-primary/5 hover:text-primary"
            onClick={() => void handleShare()}
            disabled={!hasAnyBarcode || isBusy}
          >
            {isBusy ? <Loader2 className="animate-spin" /> : <Share2 />}
            <span className="hidden sm:inline">Share</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handlePrint()}
            disabled={!hasAnyBarcode || isBusy}
          >
            {isBusy ? <Loader2 className="animate-spin" /> : <Printer />}
            {isBusy ? "Printing…" : "Print"}
            {!isBusy && stickerCount > 0 ? (
              <span className="tabular-nums">({stickerCount})</span>
            ) : null}
          </Button>
        </>
      ),
    });

    return () => clearChrome();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keep chrome in sync with print state
  }, [
    title,
    subtitle,
    backHref,
    hasAnyBarcode,
    isBusy,
    stickerCount,
    preferences,
    expanded.models,
    expanded.skippedNoBarcode.length,
    setChrome,
    clearChrome,
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)] lg:items-start lg:gap-8">
        <div className="space-y-3">
          {expanded.skippedNoBarcode.length > 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                {expanded.skippedNoBarcode.length} item(s) have no barcode and
                will be skipped.
              </p>
            </div>
          ) : null}

          {printError ? (
            <p className="text-sm text-destructive" role="alert">
              {printError}
            </p>
          ) : null}

          <section className="rounded-xl bg-card p-4 shadow-card sm:p-5">
            <h2 className="mb-3 text-[13px] font-semibold text-foreground">
              Label size
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  {
                    id: "SMALL" as QrLabelSize,
                    title: "Small",
                    subtitle: "25 × 25 mm",
                  },
                  {
                    id: "LARGE" as QrLabelSize,
                    title: "Large",
                    subtitle: "50 × 30 mm",
                  },
                ] as const
              ).map((option) => {
                const selected = preferences.labelSize === option.id;
                const optionLayout = getQrLabelLayoutConfig(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={isBusy || !hydrated}
                    onClick={() => patchPreferences({ labelSize: option.id })}
                    className={cn(
                      "rounded-xl border px-3 py-3.5 text-center transition-colors",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-muted/40 hover:border-muted-foreground/30",
                    )}
                    aria-pressed={selected}
                  >
                    <p
                      className={cn(
                        "text-[13px] font-bold",
                        selected ? "text-primary" : "text-foreground",
                      )}
                    >
                      {option.title}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-[12px]",
                        selected ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {option.subtitle}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-[11px]",
                        selected ? "text-primary/80" : "text-muted-foreground",
                      )}
                    >
                      {optionLayout.columns} per row
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="my-4 h-px bg-border/60" />

            <h2 className="mb-1 text-[13px] font-semibold text-foreground">
              Label content
            </h2>
            <div className="divide-y divide-border/50">
              <SettingRow
                label="Show product title"
                control={
                  <Switch
                    checked={preferences.showTitle}
                    disabled={isBusy}
                    onCheckedChange={(checked) =>
                      patchPreferences({
                        showTitle: checked,
                        ...(checked ? { titleSize: "MEDIUM" } : {}),
                      })
                    }
                  />
                }
              />
              {preferences.showTitle ? (
                <div className="space-y-2 py-2">
                  <p className="text-[12px] text-muted-foreground">Title size</p>
                  <SegmentedChoices
                    value={preferences.titleSize}
                    disabled={isBusy}
                    onChange={(titleSize) => patchPreferences({ titleSize })}
                  />
                </div>
              ) : null}

              <SettingRow
                label="Show selling price"
                control={
                  <Switch
                    checked={preferences.showPrice}
                    disabled={isBusy}
                    onCheckedChange={(checked) =>
                      patchPreferences({
                        showPrice: checked,
                        ...(checked ? { priceSize: "MEDIUM" } : {}),
                      })
                    }
                  />
                }
              />
              {preferences.showPrice ? (
                <div className="space-y-2 py-2">
                  <p className="text-[12px] text-muted-foreground">
                    Selling price size
                  </p>
                  <SegmentedChoices
                    value={preferences.priceSize}
                    disabled={isBusy}
                    onChange={(priceSize) => patchPreferences({ priceSize })}
                  />
                </div>
              ) : null}

              <SettingRow
                label="Show barcode text"
                className="pb-0"
                control={
                  <Switch
                    checked={preferences.showCodeText}
                    disabled={isBusy}
                    onCheckedChange={(checked) =>
                      patchPreferences({ showCodeText: checked })
                    }
                  />
                }
              />
            </div>

            <div className="mb-3 mt-3 h-px bg-border/60" />

            <h2 className="mb-1 text-[13px] font-semibold text-foreground">
              Copies
            </h2>
            <SettingRow
              label="Use purchase quantity"
              description="Print one sticker per purchased unit"
              control={
                <Switch
                  checked={preferences.copiesMode === "USE_PURCHASE_QTY"}
                  disabled={isBusy}
                  onCheckedChange={(useQty) =>
                    patchPreferences({
                      copiesMode: useQty ? "USE_PURCHASE_QTY" : "FIXED",
                    })
                  }
                />
              }
            />
            {preferences.copiesMode === "FIXED" ? (
              <div className="mt-1 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                <p className="text-[13px] text-foreground">Copies per item</p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 rounded-full"
                    disabled={isBusy || preferences.fixedCopies <= 1}
                    onClick={() =>
                      patchPreferences({
                        fixedCopies: Math.max(1, preferences.fixedCopies - 1),
                      })
                    }
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <span className="w-6 text-center text-[14px] font-bold tabular-nums">
                    {preferences.fixedCopies}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 rounded-full"
                    disabled={
                      isBusy ||
                      preferences.fixedCopies >= QR_LABEL_MAX_FIXED_COPIES
                    }
                    onClick={() =>
                      patchPreferences({
                        fixedCopies: Math.min(
                          QR_LABEL_MAX_FIXED_COPIES,
                          preferences.fixedCopies + 1,
                        ),
                      })
                    }
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="lg:sticky lg:top-4">
          <div className="rounded-xl bg-card p-4 shadow-card sm:p-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-[12px] font-semibold text-muted-foreground">
                Live preview
              </h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                {labelSizeDisplay(preferences.labelSize)}
              </span>
            </div>
            <div className="mb-3 space-y-1 text-[12px] text-muted-foreground">
              <p>
                Quantity:{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {stickerCount}
                </span>
              </p>
              <p>
                Layout:{" "}
                <span className="font-semibold text-foreground">
                  {layout.columns} labels per row
                </span>
              </p>
            </div>
            <div className="flex max-h-[min(70vh,560px)] min-h-40 items-start justify-center overflow-auto rounded-xl border border-border/60 bg-muted/40 p-3 sm:p-4">
              {hasAnyBarcode ? (
                <QrLabelSheetPreview
                  models={expanded.models}
                  preferences={preferences}
                  previewScale={previewScale}
                />
              ) : (
                <p className="self-center text-center text-sm text-muted-foreground">
                  No label to preview. Add barcodes to purchased products.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
