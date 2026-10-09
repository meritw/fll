"use client";

import { useCallback, useSyncExternalStore } from "react";

const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readDraft(key: string) {
  const cached = memory.get(key);
  if (cached !== undefined) {
    return cached;
  }
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(key: string, value: string) {
  memory.set(key, value);
  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Private mode or full storage: the in-memory copy still keeps the draft for this tab.
  }
  notify();
}

/** Text kept in localStorage while typing, so a closed tab doesn't lose it. */
export function useDraft(key: string): [string, (value: string) => void, () => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readDraft(key),
    () => "",
  );
  const setValue = useCallback((next: string) => writeDraft(key, next), [key]);
  const clear = useCallback(() => writeDraft(key, ""), [key]);
  return [value, setValue, clear];
}
