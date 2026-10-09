"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { startMeetingForDay, type ActionState } from "@/lib/actions";

const initialState: ActionState = {};

/** Pick a past (or today) date and session number to open/create that journal day. */
export function StartPastMeetingForm({
  todayKey,
  defaultSessionNumber,
}: {
  todayKey: string;
  defaultSessionNumber: number;
}) {
  const [state, formAction, pending] = useActionState(startMeetingForDay, initialState);

  return (
    <details className="rounded-2xl border border-line bg-card p-4 open:pb-4">
      <summary className="cursor-pointer text-lg font-semibold marker:text-primary">
        Add an older meeting day
      </summary>
      <p className="mt-2 text-base text-muted-foreground">
        Pick a past date and the session number for the notebook. If that day already has a
        meeting, you&apos;ll open it.
      </p>
      <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm font-semibold">
          Date
          <input
            name="dayKey"
            type="date"
            required
            max={todayKey}
            defaultValue={todayKey}
            className="h-12 rounded-xl border border-input bg-background px-3 text-base font-normal"
          />
        </label>
        <label className="flex w-36 flex-col gap-1 text-sm font-semibold">
          Session #
          <input
            name="sessionNumber"
            type="number"
            required
            min={1}
            step={1}
            defaultValue={defaultSessionNumber}
            className="h-12 rounded-xl border border-input bg-background px-3 text-base font-normal"
          />
        </label>
        <Button type="submit" size="xl" disabled={pending} className="min-h-12">
          {pending ? "Opening…" : "Open this day"}
        </Button>
        {state.error ? (
          <p role="status" className="w-full text-base text-destructive">
            {state.error}
          </p>
        ) : null}
      </form>
    </details>
  );
}
