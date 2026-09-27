import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";

import { getDb } from "@/db";
import { meeting, meetingAttendee, meetingNote, user } from "@/db/schema";
import {
  parseTeamDateKey,
  teamDateKey,
  TEAM_TIME_ZONE,
  teamWeekday,
  zonedDateTime,
} from "@/lib/timezone";

/** Seed window: Mon/Thu evenings through Dec 5, 2026 (inclusive end date). */
const SEED_FROM = { year: 2026, month: 9, day: 27 };
const SEED_THROUGH = { year: 2026, month: 12, day: 5 };
const EVENING_START_HOUR = 18;
const EVENING_END_HOUR = 20;

export function listSeedSlots() {
  const slots: { dateKey: string; startsAt: Date; endsAt: Date; seedKey: string }[] = [];
  let cursor = zonedDateTime(SEED_FROM.year, SEED_FROM.month, SEED_FROM.day, 12, 0);
  const end = zonedDateTime(SEED_THROUGH.year, SEED_THROUGH.month, SEED_THROUGH.day, 23, 59);

  while (cursor.getTime() <= end.getTime()) {
    const weekday = teamWeekday(cursor);
    if (weekday === "Mon" || weekday === "Thu") {
      const dateKey = teamDateKey(cursor);
      const { year, month, day } = parseTeamDateKey(dateKey)!;
      const startsAt = zonedDateTime(year, month, day, EVENING_START_HOUR, 0);
      const endsAt = zonedDateTime(year, month, day, EVENING_END_HOUR, 0);
      slots.push({
        dateKey,
        startsAt,
        endsAt,
        seedKey: `mon-thu:${dateKey}`,
      });
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }

  return slots;
}

export async function ensureRecurringMeetings() {
  const slots = listSeedSlots();
  if (slots.length === 0) {
    return;
  }

  await getDb()
    .insert(meeting)
    .values(
      slots.map((slot) => ({
        id: crypto.randomUUID(),
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        title: "Team meeting",
        seedKey: slot.seedKey,
        createdById: null,
      })),
    )
    .onConflictDoNothing({ target: meeting.seedKey });
}

export async function listMeetings() {
  return getDb().query.meeting.findMany({
    orderBy: (table, { asc: orderAsc }) => [orderAsc(table.startsAt)],
    columns: {
      id: true,
      startsAt: true,
      endsAt: true,
      title: true,
      summary: true,
      seedKey: true,
      attendanceRecordedAt: true,
    },
  });
}

export async function listMeetingsForMonth(year: number, month: number) {
  const start = zonedDateTime(year, month, 1, 0, 0);
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = zonedDateTime(endYear, endMonth, 1, 0, 0);

  return getDb()
    .select({
      id: meeting.id,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      title: meeting.title,
      summary: meeting.summary,
      attendanceRecordedAt: meeting.attendanceRecordedAt,
    })
    .from(meeting)
    .where(and(gte(meeting.startsAt, start), lt(meeting.startsAt, end)))
    .orderBy(asc(meeting.startsAt));
}

export async function getMeeting(id: string) {
  const row = await getDb().query.meeting.findFirst({
    where: (table, { eq: equals }) => equals(table.id, id),
    with: {
      attendanceRecordedBy: { columns: { id: true, name: true } },
      attendees: {
        with: { user: { columns: { id: true, name: true, role: true } } },
      },
      notes: {
        orderBy: (table, { asc: orderAsc }) => [orderAsc(table.createdAt)],
        with: { author: { columns: { id: true, name: true } } },
      },
    },
  });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    title: row.title,
    summary: row.summary,
    seedKey: row.seedKey,
    attendanceRecordedAt: row.attendanceRecordedAt,
    attendanceRecordedBy: row.attendanceRecordedBy,
    attendees: row.attendees
      .map((item) => item.user)
      .sort((left, right) => left.name.localeCompare(right.name)),
    notes: row.notes.map((note) => ({
      id: note.id,
      body: note.body,
      createdAt: note.createdAt,
      authorName: note.author.name,
      authorId: note.author.id,
    })),
  };
}

export async function createOneOffMeeting(input: {
  userId: string;
  dateKey: string;
  title?: string;
  summary?: string;
  startHour?: number;
  endHour?: number;
}) {
  const parsed = parseTeamDateKey(input.dateKey);
  if (!parsed) {
    return { error: "Pick a valid date." };
  }

  const startHour = input.startHour ?? EVENING_START_HOUR;
  const endHour = input.endHour ?? EVENING_END_HOUR;
  if (startHour < 0 || startHour > 23 || endHour <= startHour || endHour > 24) {
    return { error: "Pick a sensible start and end time." };
  }

  const title = input.title?.trim() || "Team meeting";
  if (title.length > 80) {
    return { error: "Use a shorter title." };
  }
  const summary = input.summary?.trim() || null;
  if (summary && summary.length > 500) {
    return { error: "Use a shorter summary." };
  }

  const startsAt = zonedDateTime(parsed.year, parsed.month, parsed.day, startHour, 0);
  const endsAt = zonedDateTime(
    parsed.year,
    parsed.month,
    parsed.day,
    endHour === 24 ? 23 : endHour,
    endHour === 24 ? 59 : 0,
  );
  const id = crypto.randomUUID();

  await getDb().insert(meeting).values({
    id,
    startsAt,
    endsAt,
    title,
    summary,
    seedKey: null,
    createdById: input.userId,
  });

  return { id };
}

export async function saveAttendance(input: {
  meetingId: string;
  recordedById: string;
  attendeeIds: string[];
}) {
  const [existing] = await getDb()
    .select({ id: meeting.id })
    .from(meeting)
    .where(eq(meeting.id, input.meetingId))
    .limit(1);
  if (!existing) {
    return { error: "That meeting is missing." };
  }

  const unique = [...new Set(input.attendeeIds.filter(Boolean))];
  let allowed: string[] = [];
  if (unique.length > 0) {
    const rows = await getDb().select({ id: user.id }).from(user).where(inArray(user.id, unique));
    allowed = rows.map((row) => row.id);
  }

  const recordedAt = new Date();
  await getDb().transaction(async (tx) => {
    await tx.delete(meetingAttendee).where(eq(meetingAttendee.meetingId, input.meetingId));
    if (allowed.length > 0) {
      await tx.insert(meetingAttendee).values(
        allowed.map((userId) => ({
          meetingId: input.meetingId,
          userId,
        })),
      );
    }
    await tx
      .update(meeting)
      .set({
        attendanceRecordedById: input.recordedById,
        attendanceRecordedAt: recordedAt,
        updatedAt: recordedAt,
      })
      .where(eq(meeting.id, input.meetingId));
  });

  return { ok: true as const };
}

export async function addMeetingNote(input: {
  meetingId: string;
  authorId: string;
  body: string;
}) {
  const body = input.body.trim();
  if (!body) {
    return { error: "Write a note first." };
  }
  if (body.length > 4000) {
    return { error: "Use a shorter note." };
  }

  const [existing] = await getDb()
    .select({ id: meeting.id })
    .from(meeting)
    .where(eq(meeting.id, input.meetingId))
    .limit(1);
  if (!existing) {
    return { error: "That meeting is missing." };
  }

  const id = crypto.randomUUID();
  await getDb().insert(meetingNote).values({
    id,
    meetingId: input.meetingId,
    body,
    authorId: input.authorId,
  });

  return { id };
}

export async function updateMeetingSummary(input: {
  meetingId: string;
  title?: string;
  summary?: string;
}) {
  const [existing] = await getDb()
    .select({ id: meeting.id })
    .from(meeting)
    .where(eq(meeting.id, input.meetingId))
    .limit(1);
  if (!existing) {
    return { error: "That meeting is missing." };
  }

  const title = input.title?.trim();
  const summary = input.summary?.trim();
  if (title !== undefined && title.length > 80) {
    return { error: "Use a shorter title." };
  }
  if (summary !== undefined && summary.length > 500) {
    return { error: "Use a shorter summary." };
  }

  await getDb()
    .update(meeting)
    .set({
      ...(title !== undefined ? { title: title || null } : {}),
      ...(summary !== undefined ? { summary: summary || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(meeting.id, input.meetingId));

  return { ok: true as const };
}

export async function listUpcomingMeetings(limit = 20) {
  return getDb()
    .select({
      id: meeting.id,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      title: meeting.title,
    })
    .from(meeting)
    .where(gte(meeting.startsAt, new Date(Date.now() - 12 * 60 * 60 * 1000)))
    .orderBy(asc(meeting.startsAt))
    .limit(limit);
}

export async function listRecentMeetings(limit = 40) {
  return getDb()
    .select({
      id: meeting.id,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      title: meeting.title,
    })
    .from(meeting)
    .orderBy(desc(meeting.startsAt))
    .limit(limit);
}

export { TEAM_TIME_ZONE, EVENING_START_HOUR, EVENING_END_HOUR };
