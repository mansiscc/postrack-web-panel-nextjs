"use client";

import { useCallback, useEffect, useState } from "react";

import {
  emptyCartState,
  type BillingCartState,
  type CartItem,
} from "@/hooks/features/billing/types";

function storageKey(companyId: string) {
  return `postrack_cart_${companyId}`;
}

export function useBillingCart(companyId: string, defaultAccountId: string) {
  const [cart, setCart] = useState<BillingCartState>(() =>
    emptyCartState(defaultAccountId),
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(companyId));
      if (raw) {
        const parsed = JSON.parse(raw) as BillingCartState;
        setCart({
          ...emptyCartState(defaultAccountId),
          ...parsed,
          selectedAccountId:
            parsed.selectedAccountId || defaultAccountId,
        });
      } else {
        setCart(emptyCartState(defaultAccountId));
      }
    } catch {
      setCart(emptyCartState(defaultAccountId));
    }
    setHydrated(true);
  }, [companyId, defaultAccountId]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storageKey(companyId), JSON.stringify(cart));
  }, [cart, companyId, hydrated]);

  const clearCart = useCallback(() => {
    const next = emptyCartState(defaultAccountId);
    setCart(next);
    localStorage.removeItem(storageKey(companyId));
  }, [companyId, defaultAccountId]);

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
    setCart((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== id) return item;
        const capped =
          !item.isManual && item.maxQuantity
            ? Math.min(Math.max(quantity, 0), item.maxQuantity)
            : Math.max(quantity, 0);
        return { ...item, quantity: capped };
      }),
    }));
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
