import { isNotebookKind, type DayNoteKind, type NotebookKind } from "@/lib/notebook";

/** One persistence step for a Note-tab save. */
export type DayNoteWrite =
  | { type: "meetingNote"; kind: NotebookKind }
  | { type: "journalEntry"; milestone: boolean };

/**
 * Decide what to write for a day note.
 *
 * A milestone checked on a meeting day must also leave a normal day-record note
 * (notebook line or non-milestone journal entry). The milestone itself is a
 * separate journal row so the season timeline can show it.
 */
export function planDayNoteWrites(input: {
  kind: DayNoteKind;
  milestone: boolean;
  hasMeeting: boolean;
}): DayNoteWrite[] {
  const writes: DayNoteWrite[] = [];
  const { kind, milestone, hasMeeting } = input;

  if (hasMeeting && isNotebookKind(kind)) {
    writes.push({ type: "meetingNote", kind });
  } else {
    // Without a meeting, the journal row carries the milestone flag.
    // With a meeting + "other", this row is the day-record copy (not a milestone).
    writes.push({ type: "journalEntry", milestone: Boolean(milestone && !hasMeeting) });
  }

  if (milestone && hasMeeting) {
    writes.push({ type: "journalEntry", milestone: true });
  }

  return writes;
}

/**
 * When a journal entry is tied to a meeting, timeline / season placement follows
 * the meeting day (startsAt), not the moment the row was inserted.
 */
export function journalEntryAt(entry: {
  createdAt: Date;
  relatedMeeting: { startsAt: Date } | null;
}): Date {
  return entry.relatedMeeting?.startsAt ?? entry.createdAt;
}
