"use client";

import { useState } from "react";
import { cn } from "cn";

import { SaveStatus, type SaveState } from "@/components/journal/save-status";
import { useDraft } from "@/components/journal/use-draft";
import { Button } from "@/components/ui/button";
import { postMissionNote, setMissionStatusAction } from "@/lib/actions";
import {
  MISSION_STATUS_CLASSES,
  MISSION_STATUS_LABELS,
  MISSION_STATUSES,
  missionCode,
  type MissionStatus,
} from "@/lib/mission-status";

export type RobotMission = {
  id: number;
  number: number;
  name: string;
  status: MissionStatus;
  mine: boolean;
};

/** Mission results save on tap; "What did you change?" is typed, so it has a Save button. */
export function RobotTab({
  meetingId,
  missions,
  ensureMeeting,
  onSaved,
}: {
  meetingId: string | null;
  missions: RobotMission[];
  ensureMeeting: () => Promise<string>;
  onSaved: (meetingId: string | undefined) => void;
}) {
  const [statuses, setStatuses] = useState(
    () => new Map(missions.map((item) => [item.id, item.status])),
  );
  const [save, setSave] = useState<SaveState>(null);
  const mine = missions.filter((item) => item.mine);
  const others = missions.filter((item) => !item.mine);
  const [noteMission, setNoteMission] = useState<number>(mine[0]?.id ?? missions[0]?.id ?? 0);
  const [note, setNote, clearNote] = useDraft(`draft:robot:${meetingId ?? "today"}`);
  const [noteSave, setNoteSave] = useState<SaveState>(null);
  const [notePending, setNotePending] = useState(false);

  function setOne(id: number, status: MissionStatus) {
    setStatuses((prior) => new Map(prior).set(id, status));
  }

  async function pick(mission: RobotMission, status: MissionStatus) {
    const prior = statuses.get(mission.id) ?? "none";
    if (prior === status) return;
    setOne(mission.id, status);
    setNoteMission(mission.id);
    try {
      const target = await ensureMeeting();
      const result = await setMissionStatusAction({
        missionId: mission.id,
        status,
        meetingId: target,
      });
      if ("error" in result) {
        setOne(mission.id, prior);
        setSave({ kind: "error", text: result.error });
        return;
      }
      setSave({ kind: "saved", text: result.message });
      onSaved(target);
    } catch (error) {
      setOne(mission.id, prior);
      setSave({
        kind: "error",
        text: error instanceof Error && error.message ? error.message : "That didn't save. Try again.",
      });
    }
  }

  async function saveNote(event: React.FormEvent) {
    event.preventDefault();
    setNotePending(true);
    try {
      const target = await ensureMeeting();
      const result = await postMissionNote({ missionId: noteMission, body: note, meetingId: target });
      if ("error" in result) {
        setNoteSave({ kind: "error", text: result.error });
        return;
      }
      clearNote();
      setNoteSave({ kind: "saved", text: result.message });
      onSaved(target);
    } catch {
      setNoteSave({ kind: "error", text: "That didn't save. Try again." });
    } finally {
      setNotePending(false);
    }
  }

  function row(mission: RobotMission) {
    const current = statuses.get(mission.id) ?? "none";
    return (
      <li key={mission.id} className="flex flex-col gap-2 rounded-2xl bg-paper p-3">
        <span className="font-semibold">
          <span className="font-mono text-base text-muted-foreground">{missionCode(mission.number)}</span>{" "}
          {mission.name}
        </span>
        <div
          role="group"
          aria-label={`${mission.name} result`}
          className="grid grid-cols-2 gap-1.5 min-[480px]:grid-cols-4"
        >
          {MISSION_STATUSES.map((status) => {
            const on = status === current;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={on}
                onClick={() => pick(mission, status)}
                className={cn(
                  "min-h-12 rounded-xl text-base font-semibold",
                  on ? MISSION_STATUS_CLASSES[status] : "bg-card ring-1 ring-line hover:bg-muted",
                )}
              >
                {MISSION_STATUS_LABELS[status]}
              </button>
            );
          })}
        </div>
      </li>
    );
  }

  return (
    <section className="flex flex-col gap-5 rounded-3xl bg-card p-5 ring-1 ring-line sm:p-6">
      <h2 className="text-2xl font-bold">Robot update</h2>

      <div className="flex flex-col gap-3">
        <h3 className="font-semibold">How did each mission go?</h3>
        {mine.length > 0 ? (
          <ul className="flex flex-col gap-2.5" aria-label="Your missions">
            {mine.map(row)}
          </ul>
        ) : (
          <p className="text-muted-foreground">
            You&apos;re not on a mission yet. Pick any mission below, or join one on the Missions page.
          </p>
        )}
        {others.length > 0 ? (
          <details className="group rounded-2xl ring-1 ring-line" open={mine.length === 0}>
            <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold">
              {mine.length > 0 ? "Show all missions" : "All missions"}
            </summary>
            <ul className="flex flex-col gap-2.5 p-3 pt-0">{others.map(row)}</ul>
          </details>
        ) : null}
        <SaveStatus state={save} idle="Mission results save as soon as you tap them." />
      </div>

      {missions.length > 0 ? (
        <form onSubmit={saveNote} className="flex flex-col gap-2 border-t border-line pt-4">
          <label htmlFor="robot-mission" className="font-semibold">
            What did you change?
          </label>
          <select
            id="robot-mission"
            value={noteMission}
            onChange={(event) => setNoteMission(Number(event.target.value))}
            className="h-12 rounded-lg border border-input bg-card px-3 text-lg"
          >
            {missions.map((item) => (
              <option key={item.id} value={item.id}>
                {missionCode(item.number)} {item.name}
              </option>
            ))}
          </select>
          <textarea
            aria-label="What did you change?"
            rows={3}
            maxLength={4000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="We slowed the arm motor so it stops dropping the piece."
            className="rounded-xl border border-input bg-card px-3 py-3 text-lg outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button
            type="submit"
            size="xl"
            disabled={notePending || !note.trim()}
            className="self-start"
          >
            {notePending ? "Saving…" : "Save"}
          </Button>
          {noteSave ? <SaveStatus state={noteSave} /> : null}
        </form>
      ) : null}
    </section>
  );
}
