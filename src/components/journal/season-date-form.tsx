"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { addSeasonDate, type ActionState } from "@/lib/actions";

const initialState: ActionState = {};

/** Coach-only: add a season date (scrimmage, qualifier…) to the strip. */
export function SeasonDateForm() {
  const [state, formAction, pending] = useActionState(addSeasonDate, initialState);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Name
        <input
          name="title"
          required
          maxLength={60}
          placeholder="Qualifier"
          className="h-11 rounded-lg border border-input bg-card px-3 text-base font-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Date
        <input
          name="dayKey"
          type="date"
          required
          className="h-11 rounded-lg border border-input bg-card px-3 text-base font-normal"
        />
      </label>
      <Button type="submit" disabled={pending} className="h-11 px-4 text-base">
        {pending ? "Saving…" : "Add date"}
      </Button>
      {state.error || state.message ? (
        <p role="status" className={state.error ? "w-full text-destructive" : "w-full text-present-ink"}>
          {state.error ?? state.message}
        </p>
      ) : null}
    </form>
  );
}
