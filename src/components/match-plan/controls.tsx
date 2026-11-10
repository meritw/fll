import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "cn";
import { useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { commitNumberDraft } from "@/lib/match-plan/number-draft";
import type { HomeBase } from "@/lib/match-plan/plan";

export const HOME_CLASSES: Record<HomeBase, string> = {
  RED: "bg-red-600 text-white",
  BLUE: "bg-blue-600 text-white",
};

export function HomePill({ home }: { home: HomeBase }) {
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold tracking-wide", HOME_CLASSES[home])}>{home}</span>
  );
}

export const FIELD_CLASS = "h-11 bg-card text-lg md:text-base dark:bg-input/30";

/**
 * Local draft while focused; commits on blur/Enter only.
 * Best/worst ranges clamp each other in applyOp — live keystroke commits
 * (e.g. typing "80" as "8" then "80") would pull the sibling end down mid-edit.
 */
export function NumberField({
  value,
  onValue,
  className,
  onKeyDown,
  ...props
}: { value: number; onValue: (value: number) => void } & Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "type"
>) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const next = commitNumberDraft(draft);
    if (next !== null) onValue(next);
    setDraft(null);
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={draft ?? String(value)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      className={cn(FIELD_CLASS, "tabular-nums", className)}
    />
  );
}

const MOVE_BUTTON =
  "inline-flex size-11 items-center justify-center rounded-lg bg-card text-foreground ring-1 ring-line hover:bg-muted disabled:opacity-35 disabled:hover:bg-card";

export function MoveButtons({
  label,
  canUp,
  canDown,
  onMove,
}: {
  label: string;
  canUp: boolean;
  canDown: boolean;
  onMove: (by: -1 | 1) => void;
}) {
  return (
    <span className="flex shrink-0 gap-2">
      <button
        type="button"
        aria-label={`Move ${label} up`}
        disabled={!canUp}
        onClick={() => onMove(-1)}
        className={MOVE_BUTTON}
      >
        <ArrowUp className="size-5" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={`Move ${label} down`}
        disabled={!canDown}
        onClick={() => onMove(1)}
        className={MOVE_BUTTON}
      >
        <ArrowDown className="size-5" aria-hidden />
      </button>
    </span>
  );
}
