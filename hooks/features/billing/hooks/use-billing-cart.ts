"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  emptyCartState,
  type BillingCartState,
  type CartItem,
} from "@/hooks/features/billing/types";

function storageKey(companyId: string) {
  return `postrack_cart_${companyId}`;
}

function resolveAccountId(
  candidate: string | null | undefined,
  defaultAccountId: string,
  accountIds: string[],
) {
  if (candidate && accountIds.includes(candidate)) return candidate;
  if (defaultAccountId && accountIds.includes(defaultAccountId)) {
    return defaultAccountId;
  }
  return accountIds[0] ?? defaultAccountId ?? "";
}

export function useBillingCart(
  companyId: string,
  defaultAccountId: string,
  accountIds: string[] = [],
) {
  const accountIdsKey = accountIds.join(",");
  const stableAccountIds = useMemo(
    () => (accountIdsKey ? accountIdsKey.split(",") : []),
    [accountIdsKey],
  );
  const initialAccountId = resolveAccountId(
    defaultAccountId,
    defaultAccountId,
    stableAccountIds,
  );

  const [cart, setCart] = useState<BillingCartState>(() =>
    emptyCartState(initialAccountId),
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(companyId));
      if (raw) {
        const parsed = JSON.parse(raw) as BillingCartState;
        const selectedAccountId = resolveAccountId(
          parsed.selectedAccountId,
          defaultAccountId,
          stableAccountIds,
        );
        setCart({
          ...emptyCartState(selectedAccountId),
          ...parsed,
          selectedAccountId,
        });
      } else {
        setCart(
          emptyCartState(
            resolveAccountId(defaultAccountId, defaultAccountId, stableAccountIds),
          ),
        );
      }
    } catch {
      setCart(
        emptyCartState(
          resolveAccountId(defaultAccountId, defaultAccountId, stableAccountIds),
        ),
      );
    }
    setHydrated(true);
  }, [companyId, defaultAccountId, stableAccountIds]);

  useEffect(() => {
    if (!hydrated) return;
    setCart((prev) => {
      const nextAccountId = resolveAccountId(
        prev.selectedAccountId,
        defaultAccountId,
        stableAccountIds,
      );
      if (nextAccountId === prev.selectedAccountId) return prev;
      return { ...prev, selectedAccountId: nextAccountId };
    });
  }, [hydrated, defaultAccountId, stableAccountIds]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storageKey(companyId), JSON.stringify(cart));
  }, [cart, companyId, hydrated]);

  const clearCart = useCallback(() => {
    const next = emptyCartState(
      resolveAccountId(defaultAccountId, defaultAccountId, stableAccountIds),
    );
    setCart(next);
    localStorage.removeItem(storageKey(companyId));
  }, [companyId, defaultAccountId, stableAccountIds]);

  const addItem = useCallback((item: Omit<CartItem, "id">) => {
    setCart((prev) => {
      const existingIndex = prev.items.findIndex((row) => {
        if (item.isManual || row.isManual) {
          return (
            Boolean(row.isManual) &&
            Boolean(item.isManual) &&
            row.productName.trim().toLowerCase() ===
              item.productName.trim().toLowerCase() &&
            row.unitPrice === item.unitPrice
          );
        }
        return (
          row.productId === item.productId &&
          row.batchId === (item.batchId ?? null) &&
          row.unitPrice === item.unitPrice
        );
      });

      if (existingIndex >= 0) {
        const existing = prev.items[existingIndex]!;
        const nextQty = existing.quantity + item.quantity;
        const cappedQty =
          !existing.isManual && existing.maxQuantity
            ? Math.min(nextQty, existing.maxQuantity)
            : nextQty;
        const items = [...prev.items];
        items[existingIndex] = { ...existing, quantity: cappedQty };
        return { ...prev, items };
      }

      return {
        ...prev,
        items: [...prev.items, { ...item, id: crypto.randomUUID() }],
      };
    });
  }, []);

  const updateItemQty = useCallback((id: string, quantity: number) => {
    setCart((prev) => {
      if (quantity <= 0) {
        return {
          ...prev,
          items: prev.items.filter((item) => item.id !== id),
        };
      }

      return {
        ...prev,
        items: prev.items.map((item) => {
          if (item.id !== id) return item;
          const capped =
            !item.isManual && item.maxQuantity
              ? Math.min(quantity, item.maxQuantity)
              : quantity;
          return { ...item, quantity: capped };
        }),
      };
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setCart((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  }, []);

  const patchCart = useCallback((patch: Partial<BillingCartState>) => {
    setCart((prev) => ({ ...prev, ...patch }));
  }, []);

  return {
    cart,
    hydrated,
    addItem,
    updateItemQty,
    removeItem,
    clearCart,
    patchCart,
  };
}
