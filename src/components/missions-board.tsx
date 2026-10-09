"use client";

import { CircleCheck, Plus, X } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDraft } from "@/hooks/use-draft";
import {
  assignMission,
  joinMission,
  leaveMission,
  postMissionNote,
  setMissionStatusAction,
  unassignMission,
} from "@/lib/actions";
import {
  MISSION_STATUS_HINTS,
  MISSION_STATUS_LABELS,
  MISSION_STATUSES,
  type MissionStatus,
} from "@/lib/mission-status";
import { STATUS_CLASSES } from "@/components/status-pill";
import { cn } from "@/lib/utils";

const SAVE_ERROR = "That didn't save. Try again.";

type Person = { id: string; name: string };

type PeopleAction =
  | { type: "add"; person: Person }
  | { type: "remove"; id: string };

function reducePeople(state: Person[], action: PeopleAction) {
  if (action.type === "add") {
    return state.some((person) => person.id === action.person.id)
      ? state
      : [...state, action.person].sort((a, b) => a.name.localeCompare(b.name));
  }
  return state.filter((person) => person.id !== action.id);
}

function SavedLine({ error, text }: { error: string | null; text: string | null }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn("text-base", error ? "font-medium text-destructive" : "text-present-text")}
    >
      {error ?? text}
    </p>
  );
}

export function MissionPeople({
  missionId,
  assignees,
  viewer,
  students,
}: {
  missionId: number;
  assignees: Person[];
  viewer: { id: string; name: string; role: string };
  students: { id: string; name: string; load: number }[];
}) {
  const [people, applyPeople] = useOptimistic(assignees, reducePeople);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const isStudent = viewer.role === "student";
  const isCoach = viewer.role === "coach";
  const onMission = people.some((person) => person.id === viewer.id);

  function run(action: PeopleAction, call: () => Promise<object>, message: string) {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      applyPeople(action);
      try {
        const result = await call();
        if ("error" in result && typeof result.error === "string") {
          setError(result.error);
        } else {
          setSaved(message);
        }
      } catch {
        setError(SAVE_ERROR);
      }
    });
  }

  const available = students.filter(
    (student) => !people.some((person) => person.id === student.id),
  );

  return (
    <section aria-labelledby="mission-people" className="flex flex-col gap-3">
      <h3 id="mission-people" className="text-xl font-semibold">
        Who&apos;s working on it
      </h3>

      {people.length === 0 ? (
        <p className="text-ink-muted">Nobody yet. This one needs people!</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {people.map((person) => (
            <li
              key={person.id}
              className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-card py-1 pr-3 pl-1.5"
            >
              <span
                aria-hidden
                className="flex size-8 items-center justify-center rounded-full bg-primary-tint font-semibold text-primary-dark"
              >
                {person.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="font-medium">
                {person.name}
                {person.id === viewer.id ? " (you)" : ""}
              </span>
              {isCoach ? (
                <button
                  type="button"
                  aria-label={`Take ${person.name} off this mission`}
                  disabled={pending}
                  onClick={() =>
                    run(
                      { type: "remove", id: person.id },
                      () => unassignMission({ missionId, userId: person.id }),
                      `${person.name} is off this mission.`,
                    )
                  }
                  className="flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-muted hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {isStudent ? (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            aria-pressed={onMission}
            onClick={() =>
              onMission
                ? run(
                    { type: "remove", id: viewer.id },
                    () => leaveMission({ missionId }),
                    "You left this mission.",
                  )
                : run(
                    { type: "add", person: { id: viewer.id, name: viewer.name } },
                    () => joinMission({ missionId }),
                    "You're on this mission.",
                  )
            }
            className={cn(
              "flex min-h-13 items-center justify-center gap-2 rounded-xl border-2 px-5 text-lg font-semibold transition-colors sm:self-start",
              onMission
                ? "border-present bg-present-bg text-present-text"
                : "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {onMission ? <CircleCheck className="size-5" /> : <Plus className="size-5" />}
            {onMission ? "I'm on this mission" : "I want to work on this"}
          </button>
          <p className="text-base text-ink-muted">
            {onMission ? "Tap again to leave it." : "Tap to add yourself."}
          </p>
        </div>
      ) : null}

      {isCoach ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-info-bg p-4 text-info-text">
          <p className="font-semibold">Add a kid to this mission</p>
          {available.length === 0 ? (
            <p className="text-base">Every kid is already on this mission.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {available.map((student) => (
                <li key={student.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(
                        { type: "add", person: { id: student.id, name: student.name } },
                        () => assignMission({ missionId, userId: student.id }),
                        `${student.name} is on this mission.`,
                      )
                    }
                    className="min-h-11 rounded-xl border border-info/30 bg-card px-4 font-medium hover:border-info"
                  >
                    + {student.name} ({student.load})
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm">The number shows how many missions each kid already has.</p>
        </div>
      ) : null}

      <SavedLine error={error} text={saved} />
    </section>
  );
}

export function MissionStatusPicker({
  missionId,
  status,
  readOnly,
  lastChange,
}: {
  missionId: number;
  status: MissionStatus;
  readOnly: boolean;
  lastChange: string | null;
}) {
  const [current, setCurrent] = useOptimistic(status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function choose(next: MissionStatus) {
    if (next === current || readOnly) {
      return;
    }
    setError(null);
    setSaved(null);
    startTransition(async () => {
      setCurrent(next);
      try {
        const result = await setMissionStatusAction({ missionId, status: next });
        if ("error" in result && result.error) {
          setError(result.error);
        } else {
          setSaved(`Saved: ${MISSION_STATUS_LABELS[next].toLowerCase()}`);
        }
      } catch {
        setError(SAVE_ERROR);
      }
    });
  }

  return (
    <section aria-labelledby="mission-status" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="mission-status" className="text-xl font-semibold">
          How&apos;s it going?
        </h3>
        <p
          role="status"
          aria-live="polite"
          className={cn("text-base", error ? "font-medium text-destructive" : "text-present-text")}
        >
          {error ?? saved ?? (readOnly ? "" : "✓ Saved automatically")}
        </p>
      </div>
      <div role="group" aria-labelledby="mission-status" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MISSION_STATUSES.map((option) => {
          const selected = current === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              disabled={readOnly || (pending && !selected)}
              onClick={() => choose(option)}
              className={cn(
                "flex min-h-[68px] flex-col items-start justify-center gap-0.5 rounded-xl border-2 px-3 py-2 text-left transition-colors",
                selected
                  ? cn(STATUS_CLASSES[option], "border-transparent")
                  : "border-line bg-card hover:border-primary",
                readOnly ? "cursor-default" : "",
              )}
            >
              <span className="text-lg font-semibold">{MISSION_STATUS_LABELS[option]}</span>
              <span className={cn("text-sm leading-tight", selected ? "" : "text-ink-muted")}>
                {MISSION_STATUS_HINTS[option]}
              </span>
            </button>
          );
        })}
      </div>
      {lastChange ? <p className="text-sm text-ink-muted">{lastChange}</p> : null}
    </section>
  );
}

export function MissionNoteForm({ missionId }: { missionId: number }) {
  const [body, setBody, clearDraft] = useDraft(`draft:mission-note:${missionId}`);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function save() {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      try {
        const result = await postMissionNote({ missionId, body });
        if ("error" in result && result.error) {
          setError(result.error);
        } else {
          clearDraft();
          setSaved("Saved.");
        }
      } catch {
        setError(SAVE_ERROR);
      }
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="flex flex-col gap-2"
    >
      <Label htmlFor={`mission-note-${missionId}`} className="text-base font-semibold">
        Add a note
      </Label>
      <Textarea
        id={`mission-note-${missionId}`}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={4000}
        rows={3}
        placeholder="We tried… / It works better when… / Next we should…"
        className="min-h-24 rounded-xl px-3 py-2 text-lg md:text-lg"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="xl" disabled={pending || !body.trim()} className="rounded-xl">
          {pending ? "Saving…" : "Save note"}
        </Button>
        <p className="text-sm text-ink-muted">
          Draft kept as you type. Saved notes also show in the journal.
        </p>
      </div>
      <SavedLine error={error} text={saved} />
    </form>
  );
}
