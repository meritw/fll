"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveMeetingDetails, type ActionState } from "@/lib/actions";

const initialState: ActionState = {};

/** Coach-only: set a day's title or session number. */
export function MeetingDetailsForm({
  meetingId,
  title,
  sessionNumber,
}: {
  meetingId: string;
  title: string | null;
  sessionNumber: number | null;
}) {
  const [state, formAction, pending] = useActionState(saveMeetingDetails, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
      <input type="hidden" name="meetingId" value={meetingId} />
      <input type="hidden" name="summary" value="" />
      <div className="flex min-w-32 flex-col gap-2">
        <Label htmlFor="detail-session" className="text-base">
          Session
        </Label>
        <Input
          id="detail-session"
          name="sessionNumber"
          type="number"
          min={1}
          defaultValue={sessionNumber ?? ""}
          className="h-12 rounded-xl px-3 text-lg md:text-lg"
        />
      </div>
      <div className="flex min-w-48 flex-1 flex-col gap-2">
        <Label htmlFor="detail-title" className="text-base">
          Title
        </Label>
        <Input
          id="detail-title"
          name="title"
          defaultValue={title ?? ""}
          maxLength={80}
          className="h-12 rounded-xl px-3 text-lg md:text-lg"
        />
      </div>
      <Button type="submit" size="xl" variant="secondary" disabled={pending} className="rounded-xl">
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
