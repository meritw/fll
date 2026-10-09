"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "cn";

import { SaveStatus, type SaveState } from "@/components/journal/save-status";
import { toggleAttendance } from "@/lib/actions";

/** Kids tap their own name when they arrive. Every tap saves on its own. */
export function AttendanceTab({
  meetingId,
  isToday,
  students,
  onSaved,
}: {
  meetingId: string | null;
  isToday: boolean;
  students: { id: string; name: string; present: boolean }[];
  onSaved: (meetingId: string | undefined) => void;
}) {
  const [present, setPresent] = useState(
    () => new Set(students.filter((person) => person.present).map((person) => person.id)),
  );
  const [save, setSave] = useState<SaveState>(null);

  function setOne(id: string, here: boolean) {
    setPresent((prior) => {
      const next = new Set(prior);
      if (here) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function tap(id: string) {
    const here = !present.has(id);
    setOne(id, here);
    try {
      const result = await toggleAttendance({ meetingId, userId: id, present: here });
      if ("error" in result) {
        setOne(id, !here);
        setSave({ kind: "error", text: result.error });
        return;
      }
      setSave({ kind: "saved", text: result.message });
      onSaved(result.meetingId);
    } catch {
      setOne(id, !here);
      setSave({ kind: "error", text: "That didn't save. Try again." });
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-line sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-bold">{isToday ? "Who's here today?" : "Who was here?"}</h2>
        <span className="font-semibold text-present">
          {present.size} of {students.length} here
        </span>
      </div>
      <p className="text-muted-foreground">
        {isToday ? "Tap your name when you arrive. " : ""}It saves right away. Tap again if you
        made a mistake.
      </p>
      {students.length === 0 ? (
        <p className="text-muted-foreground">No students yet. A coach adds them on the People page.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2">
          {students.map((person) => {
            const here = present.has(person.id);
            return (
              <button
                key={person.id}
                type="button"
                aria-pressed={here}
                onClick={() => tap(person.id)}
                className={cn(
                  "flex min-h-15 items-center gap-3 rounded-2xl px-4 text-left text-xl font-semibold",
                  here
                    ? "border-2 border-present bg-present-tint text-present-ink"
                    : "border border-line bg-card hover:bg-muted",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2 bg-card",
                    here ? "border-present" : "border-foreground/25",
                  )}
                >
                  {here ? <Check className="size-4 text-present" strokeWidth={3} /> : null}
                </span>
                {person.name}
              </button>
            );
          })}
        </div>
      )}
      <SaveStatus state={save} />
    </section>
  );
}
