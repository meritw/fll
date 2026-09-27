import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { journalEntry, meeting } from "@/db/schema";

export async function listJournalEntries() {
  const rows = await getDb().query.journalEntry.findMany({
    orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
    with: {
      author: { columns: { id: true, name: true } },
      relatedMeeting: {
        columns: { id: true, startsAt: true, endsAt: true, title: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt,
    authorName: row.author.name,
    authorId: row.author.id,
    relatedMeeting: row.relatedMeeting
      ? {
          id: row.relatedMeeting.id,
          startsAt: row.relatedMeeting.startsAt,
          endsAt: row.relatedMeeting.endsAt,
          title: row.relatedMeeting.title,
        }
      : null,
  }));
}

export async function createJournalEntry(input: {
  authorId: string;
  body: string;
  title?: string;
  relatedMeetingId?: string | null;
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
  if (relatedMeetingId) {
    const [existing] = await getDb()
      .select({ id: meeting.id })
      .from(meeting)
      .where(eq(meeting.id, relatedMeetingId))
      .limit(1);
    if (!existing) {
      return { error: "That meeting is missing." };
    }
  }

  const id = crypto.randomUUID();
  await getDb().insert(journalEntry).values({
    id,
    title,
    body,
    authorId: input.authorId,
    relatedMeetingId,
  });

  return { id };
}

export async function getJournalEntry(id: string) {
  const row = await getDb().query.journalEntry.findFirst({
    where: (table, { eq: equals }) => equals(table.id, id),
    with: {
      author: { columns: { id: true, name: true } },
      relatedMeeting: {
        columns: { id: true, startsAt: true, endsAt: true, title: true },
      },
    },
  });
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt,
    authorName: row.author.name,
    relatedMeeting: row.relatedMeeting,
  };
}

export async function listJournalEntriesRecent(limit = 5) {
  return getDb()
    .select({
      id: journalEntry.id,
      title: journalEntry.title,
      createdAt: journalEntry.createdAt,
    })
    .from(journalEntry)
    .orderBy(desc(journalEntry.createdAt))
    .limit(limit);
}
