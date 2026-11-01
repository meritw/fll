import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "cn";
import { useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
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

export function NumberField({
  value,
  onValue,
  className,
  ...props
}: { value: number; onValue: (value: number) => void } & Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "type"
>) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={draft ?? String(value)}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        if (/^\d+$/.test(text)) onValue(Number(text));
      }}
      onBlur={() => setDraft(null)}
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
