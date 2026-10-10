import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { journalEntry, meeting, seasonEvent } from "@/db/schema";
import { parseTeamDateKey } from "@/lib/timezone";

export { journalEntryAt } from "@/lib/day-note-plan";

export async function listJournalEntries() {
  const rows = await getDb().query.journalEntry.findMany({
    orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
    with: {
      author: { columns: { id: true, name: true } },
      relatedMeeting: {
        columns: { id: true, startsAt: true, title: true, sessionNumber: true },
      },
      media: {
        orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
        with: { uploader: { columns: { id: true, name: true } } },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    milestone: row.milestone,
    fromHome: row.fromHome,
    createdAt: row.createdAt,
    authorName: row.author.name,
    authorId: row.author.id,
    relatedMeeting: row.relatedMeeting,
    media: row.media.map((item) => ({
      id: item.id,
      contentType: item.contentType,
      caption: item.caption,
      createdAt: item.createdAt,
      uploaderName: item.uploader.name,
      uploaderId: item.uploader.id,
    })),
  }));
}

export type JournalEntryItem = Awaited<ReturnType<typeof listJournalEntries>>[number];

/** Headline for a milestone or note card: its title, else the first line of the body. */
export function entryHeadline(entry: { title: string | null; body: string }) {
  const title = entry.title?.trim();
  if (title) {
    return title;
  }
  const first = entry.body.trim().split("\n")[0] ?? "";
  return first.length > 90 ? `${first.slice(0, 87).trimEnd()}…` : first;
}

export async function createJournalEntry(input: {
  authorId: string;
  body: string;
  title?: string;
  relatedMeetingId?: string | null;
  milestone?: boolean;
  fromHome?: boolean;
}) {
  const body = input.body.trim();
  if (!body) {
    return { error: "Write something first." };
  }
  if (body.length > 8000) {
    return { error: "Use a shorter entry." };
  }

  const title = input.title?.trim() || null;
  if (title && title.length > 120) {
    return { error: "Use a shorter title." };
  }

  const relatedMeetingId: string | null = input.relatedMeetingId?.trim() || null;
  let meetingStartsAt: Date | null = null;
  if (relatedMeetingId) {
    const [row] = await getDb()
      .select({ startsAt: meeting.startsAt })
      .from(meeting)
      .where(eq(meeting.id, relatedMeetingId))
      .limit(1);
    if (!row) {
      return { error: "That meeting is missing." };
    }
    meetingStartsAt = row.startsAt;
  }

  const id = crypto.randomUUID();
  await getDb().insert(journalEntry).values({
    id,
    title,
    body,
    authorId: input.authorId,
    relatedMeetingId,
    milestone: Boolean(input.milestone),
    fromHome: Boolean(input.fromHome) && !relatedMeetingId,
    // Attach milestones / meeting-linked notes to the meeting day, not "now".
    ...(meetingStartsAt ? { createdAt: meetingStartsAt } : {}),
  });

  return { id };
}

export async function listSeasonEvents() {
  return getDb()
    .select({ id: seasonEvent.id, title: seasonEvent.title, dayKey: seasonEvent.dayKey })
    .from(seasonEvent)
    .orderBy(asc(seasonEvent.dayKey));
}

export async function addSeasonEvent(input: { title: string; dayKey: string; userId: string }) {
  const title = input.title.trim();
  if (!title) {
    return { error: "Name the date, like Qualifier." };
  }
  if (title.length > 60) {
    return { error: "Use a shorter name." };
  }
  if (!parseTeamDateKey(input.dayKey)) {
    return { error: "Pick a date." };
  }
  await getDb().insert(seasonEvent).values({
    id: crypto.randomUUID(),
    title,
    dayKey: input.dayKey.trim(),
    createdById: input.userId,
  });
  return { ok: true as const };
}

export async function deleteSeasonEvent(id: string) {
  await getDb().delete(seasonEvent).where(eq(seasonEvent.id, id));
  return { ok: true as const };
}
