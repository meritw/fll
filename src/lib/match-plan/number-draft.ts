/** Digits-only draft to commit; anything else keeps the previous value. */
export function commitNumberDraft(draft: string): number | null {
  return /^\d+$/.test(draft) ? Number(draft) : null;
}
