"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "cn";

import type { Viewer } from "@/components/journal/day-tabs";
import { SaveStatus, type SaveState } from "@/components/journal/save-status";
import { useDraft } from "@/components/journal/use-draft";
import { Button } from "@/components/ui/button";
import { postDayNote } from "@/lib/actions";
import type { DayNoteKind } from "@/lib/notebook";

const KINDS: { kind: DayNoteKind; label: string; hint: string; placeholder: string }[] = [
  {
    kind: "progress",
    label: "Today's progress",
    hint: "What we built or got working",
    placeholder: "Today we got the arm to…",
  },
  {
    kind: "lesson",
    label: "Lesson learned",
    hint: "Something we figured out",
    placeholder: "We learned that…",
  },
  {
    kind: "action",
    label: "Next time",
    hint: "A to-do for the next meeting",
    placeholder: "Next time we need to…",
  },
  {
    kind: "other",
    label: "Other",
    hint: "Ideas, research, team stuff",
    placeholder: "Anything else the team should remember…",
  },
];

/** Typed notes keep a Save button (team members expect one) plus a local draft so nothing is lost. */
export function NoteTab({
  meetingId,
  isToday,
  viewer,
  onSaved,
}: {
  meetingId: string | null;
  isToday: boolean;
  viewer: Viewer;
  onSaved: (meetingId: string | undefined) => void;
}) {
  const writer = viewer.role === "student" || viewer.role === "coach";
  const [kind, setKind] = useState<DayNoteKind>(writer ? "progress" : "other");
  const [fromHome, setFromHome] = useState(false);
  const [milestone, setMilestone] = useState(false);
  const draftKey = `draft:note:${fromHome ? "home" : meetingId ?? "today"}`;
  const [body, setBody, clearBody] = useDraft(draftKey);
  const [save, setSave] = useState<SaveState>(null);
  const [pending, setPending] = useState(false);
  const current = KINDS.find((item) => item.kind === kind) ?? KINDS[0];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await postDayNote({
        meetingId: fromHome ? "home" : meetingId,
        kind,
        body,
        milestone: writer && milestone,
      });
      if ("error" in result) {
        setSave({ kind: "error", text: result.error });
        return;
      }
      clearBody();
      setMilestone(false);
      setSave({ kind: "saved", text: result.message });
      onSaved(fromHome ? undefined : result.meetingId);
    } catch {
      setSave({ kind: "error", text: "That didn't save. Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-line sm:p-6"
    >
      <h2 className="text-2xl font-bold">Write a note</h2>

      {writer ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">What kind of note?</legend>
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            {KINDS.map((item) => {
              const on = item.kind === kind;
              return (
                <button
                  key={item.kind}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setKind(item.kind)}
                  className={cn(
                    "flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-2xl px-4 py-2 text-left",
                    on ? "bg-brand-soft ring-2 ring-primary" : "bg-card ring-1 ring-line hover:bg-muted",
                  )}
                >
                  <span className="text-lg font-semibold">{item.label}</span>
                  <span className="text-sm text-muted-foreground">{item.hint}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="day-note" className="font-semibold">
          Your note
        </label>
        <textarea
          id="day-note"
          rows={6}
          required
          maxLength={4000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={current.placeholder}
          className="min-h-40 rounded-xl border border-input bg-card px-3 py-3 text-lg outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {writer ? (
        <label className="flex min-h-11 items-center gap-3 text-base">
          <input
            type="checkbox"
            checked={milestone}
            onChange={(event) => setMilestone(event.target.checked)}
            className="size-5 accent-primary"
          />
          This is a big moment. Make it a milestone on the timeline.
        </label>
      ) : null}

      {isToday || fromHome ? (
        <label className="flex min-h-11 items-center gap-3 text-base">
          <input
            type="checkbox"
            checked={fromHome}
            onChange={(event) => setFromHome(event.target.checked)}
            className="size-5 accent-primary"
          />
          I&apos;m writing this from home, not at a meeting.
        </label>
      ) : null}

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Check className="mt-0.5 size-4 shrink-0 text-present" strokeWidth={2.5} aria-hidden />
        Draft kept as you type, so it won&apos;t get lost. Tap Save to add it to the journal.
        Written by {viewer.name}.
      </p>

      {save ? <SaveStatus state={save} /> : null}

      <div className="flex gap-3">
        <Button type="submit" size="xl" disabled={pending || !body.trim()} className="h-14 flex-1 text-xl">
          {pending ? "Saving…" : "Save note"}
        </Button>
        <Link
          href="/journal"
          className="inline-flex h-14 items-center justify-center rounded-lg bg-muted px-6 text-lg font-medium hover:bg-foreground/10"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
