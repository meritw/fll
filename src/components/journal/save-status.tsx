import { CircleAlert, Check } from "lucide-react";

export type SaveState = { kind: "saved" | "error"; text: string } | null;

/** Live confirmation line for auto-saves and Save buttons. */
export function SaveStatus({ state, idle }: { state: SaveState; idle?: string }) {
  if (!state && !idle) {
    return <p role="status" aria-live="polite" className="sr-only" />;
  }
  if (state?.kind === "error") {
    return (
      <p
        role="status"
        aria-live="polite"
        className="flex min-h-12 items-center gap-2 rounded-xl bg-destructive/10 px-4 text-base text-destructive"
      >
        <CircleAlert className="size-5 shrink-0" aria-hidden />
        {state.text}
      </p>
    );
  }
  return (
    <p
      role="status"
      aria-live="polite"
      className="flex min-h-12 items-center gap-2 rounded-xl bg-present-tint px-4 text-base text-present-ink"
    >
      <Check className="size-5 shrink-0 text-present" strokeWidth={2.5} aria-hidden />
      {state ? (
        <span>
          <span className="font-semibold">Saved.</span> {state.text}
        </span>
      ) : (
        <span>{idle}</span>
      )}
    </p>
  );
}
