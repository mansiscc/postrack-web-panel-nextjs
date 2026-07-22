"use client";

import { useCallback, useState } from "react";

export function useFormSheetState<T>() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);

  const openCreate = useCallback(() => {
    setEditing(null);
    setOpen(true);
  }, []);

  const openEdit = useCallback((item: T) => {
    setEditing(item);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  return {
    open,
    setOpen,
    editing,
    setEditing,
    openCreate,
    openEdit,
    close,
    isEdit: editing !== null,
  };
}
