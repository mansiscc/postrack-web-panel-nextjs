"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Like useState(serverProp), but resets when the prop changes after
 * router.refresh() / revalidatePath so list UIs stay in sync.
 */
export function useSyncedState<T>(
  value: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(value);

  useEffect(() => {
    setState(value);
  }, [value]);

  return [state, setState];
}
