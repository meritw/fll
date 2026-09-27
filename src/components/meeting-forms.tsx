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
      <h2 className="text-2xl font-semibold">Add a one-off meeting</h2>
      <p className="text-muted-foreground">
        Times are America/Los_Angeles evenings. Default is 6:00–8:00 PM.
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="meeting-summary" className="text-base">
          Short summary (optional)
        </Label>
        <Textarea
          id="meeting-summary"
          name="summary"
          rows={3}
          className="min-h-24 text-lg md:text-lg"
        />
      </div>
      <FormNotice state={state} />
      <Button type="submit" size="xl" disabled={pending}>
        {pending ? "Saving…" : "Add meeting"}
      </Button>
    </form>
  );
}

export function MeetingDetailsForm({
  meetingId,
  title,
  summary,
}: {
  meetingId: string;
  title: string | null;
  summary: string | null;
}) {
  const [state, formAction, pending] = useActionState(saveMeetingDetails, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="meetingId" value={meetingId} />
      <h2 className="text-2xl font-semibold">Meeting details</h2>
      <div className="flex flex-col gap-2">
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="detail-summary" className="text-base">
          Short summary
        </Label>
        <Textarea
          id="detail-summary"
          name="summary"
          defaultValue={summary ?? ""}
          rows={3}
          className="min-h-24 text-lg md:text-lg"
        />
      </div>
      <FormNotice state={state} />
      <Button type="submit" size="xl" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Save details"}
      </Button>
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

  const coaches = people.filter((person) => person.role === "coach");
  const students = people.filter((person) => person.role !== "coach");

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
      <h2 className="text-2xl font-semibold">Who was here?</h2>
      <p className="text-muted-foreground">
        Check everyone who showed up, then save. We remember who recorded it.
      </p>
      <PersonChecklist
        label="Students"
        people={students}
        checked={checked}
        onToggle={toggle}
      />
      <PersonChecklist label="Coaches" people={coaches} checked={checked} onToggle={toggle} />
      {[...checked].map((id) => (
        <input key={id} type="hidden" name="attendeeIds" value={id} />
      ))}
      <FormNotice state={state} />
      <Button type="submit" size="xl" disabled={pending}>
        {pending ? "Saving…" : "Save attendance"}
      </Button>
    </form>
  );
}

function PersonChecklist({
  label,
  people,
  checked,
  onToggle,
}: {
  label: string;
  people: PersonOption[];
  checked: Set<string>;
  onToggle: (id: string, next: boolean) => void;
}) {
  if (people.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xl font-semibold">{label}</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {people.map((person) => {
          const isOn = checked.has(person.id);
          return (
            <li key={person.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-lg hover:bg-muted/60">
                <Checkbox
                  checked={isOn}
                  onCheckedChange={(value) => onToggle(person.id, value === true)}
                  className="size-5"
                />
                <span>{person.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MeetingNoteForm({ meetingId }: { meetingId: string }) {
  const [state, formAction, pending] = useActionState(postMeetingNote, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="meetingId" value={meetingId} />
      <h2 className="text-2xl font-semibold">Add a note</h2>
      <p className="text-muted-foreground">
        Notes append — they never overwrite someone else’s writing.
      </p>
      <Textarea
        name="body"
        required
        rows={4}
        placeholder="What happened at this meeting?"
        className="min-h-28 text-lg md:text-lg"
      />
      <FormNotice state={state} />
      <Button type="submit" size="xl" disabled={pending}>
        {pending ? "Adding…" : "Add note"}
      </Button>
    </form>
  );
}
