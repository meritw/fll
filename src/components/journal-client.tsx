"use client";

import { X } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addSeasonEventAction,
  deleteSeasonEventAction,
  type ActionState,
} from "@/lib/actions";

export function JumpToMonth({ months }: { months: { id: string; label: string }[] }) {
  if (months.length === 0) {
    return null;
  }
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="jump-to-month" className="text-base text-ink-muted">
        Jump to
      </Label>
      <select
        id="jump-to-month"
        defaultValue=""
        onChange={(event) => {
          if (event.target.value) {
            window.location.hash = event.target.value;
            event.target.value = "";
          }
        }}
        className="h-11 rounded-xl border border-line bg-card px-3 text-base"
      >
        <option value="" disabled>
          Month…
        </option>
        {months.map((month) => (
          <option key={month.id} value={month.id}>
            {month.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const initialState: ActionState = {};

export function SeasonEventForm({ defaultDate }: { defaultDate: string }) {
  const [state, formAction, pending] = useActionState(addSeasonEventAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-1 flex-col gap-1.5 sm:min-w-48">
        <Label htmlFor="season-title" className="text-base">
          What is it?
        </Label>
        <Input
          id="season-title"
          name="title"
          required
          maxLength={60}
          placeholder="Scrimmage, qualifier…"
          className="h-11 rounded-xl px-3 text-base md:text-base"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="season-date" className="text-base">
          Date
        </Label>
        <Input
          id="season-date"
          name="dayKey"
          type="date"
          required
          defaultValue={defaultDate}
          className="h-11 rounded-xl px-3 text-base md:text-base"
        />
      </div>
      <Button type="submit" size="xl" disabled={pending} className="h-11 rounded-xl">
        {pending ? "Saving…" : "Save"}
      </Button>
      {state.error || state.message ? (
        <div className="w-full">
          <Alert variant={state.error ? "destructive" : "default"}>
            <AlertDescription className="text-base">{state.error ?? state.message}</AlertDescription>
          </Alert>
        </div>
      ) : null}
    </form>
  );
}

export function SeasonEventRemove({ id, title }: { id: string; title: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        aria-label={`Remove ${title}`}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              await deleteSeasonEventAction(id);
            } catch {
              setError("That didn't save. Try again.");
            }
          })
        }
        className="flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-muted hover:text-ink"
      >
        <X className="size-4" />
      </button>
      {error ? (
        <span role="status" className="text-sm text-destructive">
          {error}
        </span>
      ) : null}
    </span>
  );
}
