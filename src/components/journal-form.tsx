"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addJournalEntry, type ActionState } from "@/lib/actions";

const fieldClass = "h-12 px-3 text-lg md:text-lg";
const initialState: ActionState = {};

type MeetingOption = {
  id: string;
  label: string;
};

export function JournalEntryForm({ meetings }: { meetings: MeetingOption[] }) {
  const [state, formAction, pending] = useActionState(addJournalEntry, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">New journal entry</h2>
      <p className="text-muted-foreground">
        Write what the team built, tried, or learned. Your name and time are saved with it.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="journal-title" className="text-base">
          Title (optional)
        </Label>
        <Input id="journal-title" name="title" className={fieldClass} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="journal-body" className="text-base">
          Entry
        </Label>
        <Textarea
          id="journal-body"
          name="body"
          required
          rows={6}
          className="min-h-40 text-lg md:text-lg"
          placeholder="Today we…"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="journal-meeting" className="text-base">
          Related meeting (optional)
        </Label>
        <select
          id="journal-meeting"
          name="relatedMeetingId"
          defaultValue=""
          className="h-12 rounded-lg border border-input bg-transparent px-3 text-lg"
        >
          <option value="">None</option>
          {meetings.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      {state.error || state.message ? (
        <Alert variant={state.error ? "destructive" : "default"}>
          <AlertDescription className="text-base">
            {state.error ?? state.message}
          </AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" size="xl" disabled={pending}>
        {pending ? "Saving…" : "Save entry"}
      </Button>
    </form>
  );
}
