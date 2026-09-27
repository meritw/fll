"use client";

import { useActionState, useMemo, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addOneOffMeeting,
  postMeetingNote,
  recordMeetingAttendance,
  saveMeetingDetails,
  type ActionState,
} from "@/lib/actions";
import type { NotebookKind } from "@/lib/notebook";
import { NOTEBOOK_SECTION_LABELS } from "@/lib/notebook";

const fieldClass = "h-12 px-3 text-lg md:text-lg";
const initialState: ActionState = {};

function FormNotice({ state }: { state: ActionState }) {
  if (!state.error && !state.message) {
    return null;
  }
  return (
    <Alert variant={state.error ? "destructive" : "default"}>
      <AlertDescription className="text-base">{state.error ?? state.message}</AlertDescription>
    </Alert>
  );
}

export function AddMeetingForm({ defaultDate }: { defaultDate: string }) {
  const [state, formAction, pending] = useActionState(addOneOffMeeting, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">Add a one-off session</h2>
      <p className="text-muted-foreground">
        Times are America/New_York (Eastern) evenings. Default is 6:00–8:00 PM.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="meeting-date" className="text-base">
            Date
          </Label>
          <Input
            id="meeting-date"
            name="dateKey"
            type="date"
            required
            defaultValue={defaultDate}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="meeting-session" className="text-base">
            Session # (optional)
          </Label>
          <Input
            id="meeting-session"
            name="sessionNumber"
            type="number"
            min={1}
            placeholder="Auto"
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="meeting-title" className="text-base">
            Title (optional)
          </Label>
          <Input
            id="meeting-title"
            name="title"
            placeholder="Team meeting"
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="meeting-start" className="text-base">
            Start hour (0–23)
          </Label>
          <Input
            id="meeting-start"
            name="startHour"
            type="number"
            min={0}
            max={23}
            defaultValue={18}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="meeting-end" className="text-base">
            End hour (1–24)
          </Label>
          <Input
            id="meeting-end"
            name="endHour"
            type="number"
            min={1}
            max={24}
            defaultValue={20}
            className={fieldClass}
          />
        </div>
      </div>
      <FormNotice state={state} />
      <Button type="submit" size="xl" disabled={pending}>
        {pending ? "Saving…" : "Add session"}
      </Button>
    </form>
  );
}

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
      <div className="flex min-w-[8rem] flex-col gap-2">
        <Label htmlFor="detail-session" className="text-base">
          Session
        </Label>
        <Input
          id="detail-session"
          name="sessionNumber"
          type="number"
          min={1}
          defaultValue={sessionNumber ?? ""}
          className={fieldClass}
        />
      </div>
      <div className="flex min-w-[12rem] flex-1 flex-col gap-2">
        <Label htmlFor="detail-title" className="text-base">
          Title
        </Label>
        <Input
          id="detail-title"
          name="title"
          defaultValue={title ?? ""}
          className={fieldClass}
        />
      </div>
      <Button type="submit" size="xl" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      <div className="w-full">
        <FormNotice state={state} />
      </div>
    </form>
  );
}

type PersonOption = {
  id: string;
  name: string;
  role: string;
};

export function AttendanceForm({
  meetingId,
  people,
  selectedIds,
}: {
  meetingId: string;
  people: PersonOption[];
  selectedIds: string[];
}) {
  const [state, formAction, pending] = useActionState(recordMeetingAttendance, initialState);
  const initial = useMemo(() => new Set(selectedIds), [selectedIds]);
  const [checked, setChecked] = useState<Set<string>>(initial);

  const sorted = useMemo(
    () =>
      [...people].sort((left, right) => {
        if (left.role !== right.role) {
          return left.role === "student" ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      }),
    [people],
  );

  function toggle(id: string, next: boolean) {
    setChecked((prev) => {
      const copy = new Set(prev);
      if (next) {
        copy.add(id);
      } else {
        copy.delete(id);
      }
      return copy;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="meetingId" value={meetingId} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-semibold">Attendance</h2>
        <p className="text-muted-foreground">Check who was here, then save.</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {sorted.map((person) => {
          const isOn = checked.has(person.id);
          return (
            <li key={person.id}>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-lg ${
                  isOn ? "border-primary bg-primary/10" : "border-border hover:bg-muted/60"
                }`}
              >
                <Checkbox
                  checked={isOn}
                  onCheckedChange={(value) => toggle(person.id, value === true)}
                  className="size-5"
                />
                <span>{person.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {[...checked].map((id) => (
        <input key={id} type="hidden" name="attendeeIds" value={id} />
      ))}
      <FormNotice state={state} />
      <Button type="submit" size="xl" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save attendance"}
      </Button>
    </form>
  );
}

type NotebookItem = {
  id: string;
  body: string;
  authorName: string;
  createdLabel: string;
};

export function NotebookSection({
  meetingId,
  kind,
  items,
}: {
  meetingId: string;
  kind: NotebookKind;
  items: NotebookItem[];
}) {
  const [state, formAction, pending] = useActionState(postMeetingNote, initialState);
  const label = NOTEBOOK_SECTION_LABELS[kind];
  const placeholder =
    kind === "progress"
      ? "What did the team do today?"
      : kind === "action"
        ? "What should we do next meeting?"
        : "What did we learn?";

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">{label}</h2>
      {items.length === 0 ? (
        <p className="text-muted-foreground">Nothing here yet. Add item 1 below.</p>
      ) : (
        <ol className="flex list-decimal flex-col gap-3 pl-6 text-lg marker:font-semibold">
          {items.map((item) => (
            <li key={item.id} className="pl-1">
              <p className="whitespace-pre-wrap">{item.body}</p>
              <p className="mt-1 text-base text-muted-foreground">
                — {item.authorName} · {item.createdLabel}
              </p>
            </li>
          ))}
        </ol>
      )}
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="meetingId" value={meetingId} />
        <input type="hidden" name="kind" value={kind} />
        <Label htmlFor={`note-${kind}`} className="sr-only">
          Add to {label}
        </Label>
        <Textarea
          id={`note-${kind}`}
          name="body"
          required
          rows={3}
          placeholder={placeholder}
          className="min-h-24 text-lg md:text-lg"
        />
        <FormNotice state={state} />
        <Button type="submit" size="xl" disabled={pending} className="self-start">
          {pending ? "Adding…" : `Add to ${label}`}
        </Button>
      </form>
    </section>
  );
}
