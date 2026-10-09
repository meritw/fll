"use client";

import { useEffect, useState } from "react";

/**
 * A text value that is kept in localStorage while the kid types, so a closed tab
 * or dead battery doesn't lose it. Storage can throw (private mode), so every
 * access is guarded and the hook still works as plain state.
 */
export function useDraft(key: string) {
  const [value, setValue] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      // Restoring a saved draft from storage after mount is the point of this hook.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(saved ?? "");
    } catch {
      setValue("");
    }
  }, [key]);

  function update(next: string) {
    setValue(next);
    try {
      if (next) {
        window.localStorage.setItem(key, next);
      } else {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Draft just isn't kept on this device.
    }
  }

  function clear() {
    update("");
  }

  return [value, update, clear] as const;
}
