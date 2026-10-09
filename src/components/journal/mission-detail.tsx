"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { cn } from "cn";

import { SaveStatus, type SaveState } from "@/components/journal/save-status";
import { useDraft } from "@/components/journal/use-draft";
import { Button } from "@/components/ui/button";
import {
  postMissionNote,
  setMissionAssignment,
  setMissionStatusAction,
  setMyMission,
  type AutoSaveResult,
} from "@/lib/actions";
import {
  MISSION_STATUS_CLASSES,
  MISSION_STATUS_HINTS,
  MISSION_STATUS_LABELS,
  MISSION_STATUSES,
  type MissionStatus,
} from "@/lib/mission-status";

type Person = { id: string; name: string };

export function MissionDetail({
  mission,
  notes,
  viewer,
  students,
}: {
  mission: {
    id: number;
    number: number;
    name: string;
    status: MissionStatus;
    lastChange: string | null;
    assignees: Person[];
  };
  notes: { id: string; body: string; byline: string }[];
  viewer: { id: string; role: "student" | "coach" | "parent" | "other" };
  students: (Person & { load: number })[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState(mission.status);
  const [team, setTeam] = useState(mission.assignees);
  const [statusSave, setStatusSave] = useState<SaveState>(null);
  const [teamSave, setTeamSave] = useState<SaveState>(null);
  const [note, setNote, clearNote] = useDraft(`draft:mission:${mission.id}`);
  const [noteSave, setNoteSave] = useState<SaveState>(null);
  const [notePending, setNotePending] = useState(false);

  const coach = viewer.role === "coach";
  const student = viewer.role === "student";
  const canEdit = coach || student;
  const onTeam = team.some((person) => person.id === viewer.id);

  /** Apply a change now, save it, and roll back if the save fails. */
  function autoSave(
    apply: () => void,
    rollback: () => void,
    save: () => Promise<AutoSaveResult>,
    report: (state: SaveState) => void,
  ) {
    apply();
    startTransition(async () => {
      try {
        const result = await save();
        if ("error" in result) {
          rollback();
          report({ kind: "error", text: result.error });
          return;
        }
        report({ kind: "saved", text: result.message });
        router.refresh();
      } catch {
        rollback();
        report({ kind: "error", text: "That didn't save. Try again." });
      }
    });
  }

  function pickStatus(next: MissionStatus) {
    if (next === status) return;
    const prior = status;
    autoSave(
      () => setStatus(next),
      () => setStatus(prior),
      () => setMissionStatusAction({ missionId: mission.id, status: next }),
      setStatusSave,
    );
  }

  function changeTeam(person: Person, add: boolean, self: boolean) {
    const prior = team;
    const next = add
      ? [...team, person].sort((left, right) => left.name.localeCompare(right.name))
      : team.filter((item) => item.id !== person.id);
    autoSave(
      () => setTeam(next),
      () => setTeam(prior),
      () =>
        self
          ? setMyMission({ missionId: mission.id, join: add })
          : setMissionAssignment({ missionId: mission.id, userId: person.id, assigned: add }),
      setTeamSave,
    );
  }

  async function saveNote(event: React.FormEvent) {
    event.preventDefault();
    setNotePending(true);
    try {
      const result = await postMissionNote({ missionId: mission.id, body: note });
      if ("error" in result) {
        setNoteSave({ kind: "error", text: result.error });
        return;
      }
      clearNote();
      setNoteSave({ kind: "saved", text: result.message });
      router.refresh();
    } catch {
      setNoteSave({ kind: "error", text: "That didn't save. Try again." });
    } finally {
      setNotePending(false);
    }
  }

  const addable = students.filter((person) => !team.some((item) => item.id === person.id));
  const me = students.find((person) => person.id === viewer.id) ?? {
    id: viewer.id,
    name: "You",
    load: 0,
  };

  return (
    <section
      id="detail"
      aria-labelledby="mission-heading"
      className="flex min-w-0 flex-[999_1_540px] scroll-mt-4 flex-col gap-6 rounded-3xl bg-card p-5 ring-1 ring-line sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <span className="font-mono text-sm tracking-[0.06em] text-primary">
          MISSION {mission.number}
        </span>
        <h2 id="mission-heading" className="text-3xl leading-tight font-bold">
          {mission.name}
        </h2>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">Who&apos;s working on it</h3>
        <div className="flex flex-wrap items-center gap-2">
          {team.length === 0 ? (
            <span className="text-muted-foreground">Nobody yet. This one needs people!</span>
          ) : null}
          {team.map((person) => (
            <span
              key={person.id}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-muted py-1 pr-1.5 pl-1.5"
            >
              <span
                aria-hidden
                className="inline-flex size-8 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background"
              >
                {person.name.charAt(0).toUpperCase()}
              </span>
              <span className="pr-2 font-semibold">
                {person.name}
                {student && person.id === viewer.id ? " (you)" : ""}
              </span>
              {coach ? (
                <button
                  type="button"
                  onClick={() => changeTeam(person, false, false)}
                  aria-label={`Take ${person.name} off this mission`}
                  className="inline-flex size-9 items-center justify-center rounded-full bg-line hover:bg-foreground/15"
                >
                  <X className="size-4" strokeWidth={2.5} aria-hidden />
                </button>
              ) : null}
            </span>
          ))}
        </div>

        {student ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              aria-pressed={onTeam}
              onClick={() => changeTeam(me, !onTeam, true)}
              className={cn(
                "min-h-13 rounded-2xl border-2 px-5 text-lg font-semibold",
                onTeam
                  ? "border-present bg-present-tint text-present-ink"
                  : "border-primary bg-primary text-primary-foreground",
              )}
            >
              {onTeam ? "I'm on this mission" : "I want to work on this"}
            </button>
            <span className="text-base text-muted-foreground">
              {onTeam ? "Tap again to leave it." : "Tap to add yourself."}
            </span>
          </div>
        ) : null}

        {coach ? (
          <div className="flex flex-col gap-2 rounded-2xl bg-info-soft p-4">
            <span className="text-base font-semibold text-info-ink">Add a kid to this mission</span>
            {addable.length === 0 ? (
              <span className="text-base text-info-ink">Everyone is already on it.</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {addable.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => changeTeam(person, true, false)}
                    className="min-h-11 rounded-full border border-dashed border-info/50 bg-card px-4 text-base font-medium text-info-ink hover:bg-info-tint"
                  >
                    + {person.name} <span className="text-sm text-info">({person.load})</span>
                  </button>
                ))}
              </div>
            )}
            <span className="text-sm text-info-ink/80">
              The number shows how many missions each kid already has.
            </span>
          </div>
        ) : null}
        {teamSave ? <SaveStatus state={teamSave} /> : null}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold">How&apos;s it going?</h3>
          {mission.lastChange ? (
            <span className="text-sm text-muted-foreground">{mission.lastChange}</span>
          ) : null}
        </div>
        <div role="group" aria-label="Mission status" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MISSION_STATUSES.map((option) => {
            const on = option === status;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={on}
                disabled={!canEdit}
                onClick={() => pickStatus(option)}
                className={cn(
                  "flex min-h-17 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-center disabled:cursor-default",
                  on
                    ? cn(MISSION_STATUS_CLASSES[option], "ring-2 ring-foreground/20")
                    : "bg-card ring-1 ring-line enabled:hover:bg-muted",
                )}
              >
                <span className="text-lg font-bold">{MISSION_STATUS_LABELS[option]}</span>
                <span className="text-sm opacity-90">{MISSION_STATUS_HINTS[option]}</span>
              </button>
            );
          })}
        </div>
        {canEdit ? <SaveStatus state={statusSave} idle="Changes save automatically." /> : null}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">Mission notes</h3>
        {notes.length === 0 ? (
          <p className="text-muted-foreground">
            No notes yet.{canEdit ? " Write down your first idea for this mission." : ""}
          </p>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {notes.map((item) => (
              <li key={item.id} className="flex flex-col gap-1 rounded-xl bg-paper px-4 py-3">
                <p className="whitespace-pre-wrap">{item.body}</p>
                <span className="text-sm text-muted-foreground">{item.byline}</span>
              </li>
            ))}
          </ol>
        )}
        {canEdit ? (
          <form onSubmit={saveNote} className="flex flex-col gap-2">
            <label htmlFor="mission-note" className="text-base font-semibold">
              Add a note
            </label>
            <textarea
              id="mission-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={4000}
              placeholder="We tried… / It works better when… / Next we should…"
              className="min-h-28 rounded-xl border border-input bg-card px-3 py-3 text-lg outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="xl" disabled={notePending || !note.trim()}>
                {notePending ? "Saving…" : "Save note"}
              </Button>
              <span className="text-sm text-muted-foreground">
                Draft kept as you type. Saved notes also show in the journal.
              </span>
            </div>
            {noteSave ? <SaveStatus state={noteSave} /> : null}
          </form>
        ) : null}
      </div>
    </section>
  );
}
