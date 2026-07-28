"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type TopbarChromeState = {
  title?: string | null;
  leading?: ReactNode | null;
  actions?: ReactNode | null;
};

type TopbarChromeContextValue = {
  chrome: TopbarChromeState;
  setChrome: (next: TopbarChromeState) => void;
  clearChrome: () => void;
};

const TopbarChromeContext = createContext<TopbarChromeContextValue | null>(
  null,
);

export function TopbarChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChromeState] = useState<TopbarChromeState>({});

  const setChrome = useCallback((next: TopbarChromeState) => {
    setChromeState(next);
  }, []);

  const clearChrome = useCallback(() => {
    setChromeState({});
  }, []);

  const value = useMemo(
    () => ({ chrome, setChrome, clearChrome }),
    [chrome, setChrome, clearChrome],
  );

  return (
    <TopbarChromeContext.Provider value={value}>
      {children}
    </TopbarChromeContext.Provider>
  );
}

export function useTopbarChrome() {
  const context = useContext(TopbarChromeContext);
  if (!context) {
    throw new Error("useTopbarChrome must be used within TopbarChromeProvider");
  }
  return context;
}
