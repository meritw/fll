import { Timer, Wrench } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ToolChangePatch } from "@/lib/match-plan/plan";
import { SLOT_LABELS, type Swap, type ToolChangeView } from "@/lib/match-plan/view";

import { FIELD_CLASS, HomePill, NumberField } from "./controls";
import type { PlanDispatch } from "./use-match-plan";

export function ToolChangeRow({ view, dispatch }: { view: ToolChangeView; dispatch: PlanDispatch }) {
  const [open, setOpen] = useState(false);
  const { runId, toolChange, swaps, move } = view;
  const edit = (patch: ToolChangePatch) => dispatch({ type: "editToolChange", runId, patch });

  return (
    <div className="rounded-2xl border-2 border-dashed border-line bg-muted/60">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-11 w-full items-start gap-3 px-3 py-2.5 text-left"
      >
        <Wrench className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-base">
          <span className="font-semibold">Tool change</span>
          {swaps.length === 0 ? <span className="text-muted-foreground">Same tools</span> : null}
          {swaps.map((swap) => (
            <SwapLine key={swap.slot} swap={swap} />
          ))}
          {move ? (
            <span className="flex items-center gap-1.5 font-semibold">
              Carry to <HomePill home={move.to} />
            </span>
          ) : null}
          {toolChange.note ? <span className="text-muted-foreground">{toolChange.note}</span> : null}
        </span>
        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground tabular-nums">
          <Timer className="size-3.5" aria-hidden />
          {toolChange.time.bestSec}–{toolChange.time.worstSec}s
        </span>
      </button>

      {open ? (
        <div className="flex flex-col gap-3 px-3 pb-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-base font-medium">
              Best seconds
              <NumberField value={toolChange.time.bestSec} onValue={(bestSec) => edit({ bestSec })} />
            </label>
            <label className="flex flex-col gap-1.5 text-base font-medium">
              Worst seconds
              <NumberField value={toolChange.time.worstSec} onValue={(worstSec) => edit({ worstSec })} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-base font-medium">
            Note
            <Input
              value={toolChange.note}
              onChange={(event) => edit({ note: event.target.value })}
              placeholder="Who swaps what?"
              className={FIELD_CLASS}
            />
          </label>
          <Button className="h-11 self-end px-5 text-base" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SwapLine({ swap: { slot, off, on } }: { swap: Swap }) {
  const change = !off ? `put on ${on}` : !on ? `take off ${off}` : `${off} → ${on}`;
  return (
    <span>
      <span className="font-semibold">{SLOT_LABELS[slot]}:</span> {change}
    </span>
  );
}
