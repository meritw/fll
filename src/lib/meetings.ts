import { and, asc, desc, eq, gte, inArray, lt, max, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { meeting, meetingAttendee, meetingNote, user } from "@/db/schema";
import { isNotebookKind, NOTEBOOK_SECTION_LABELS, type NotebookKind } from "@/lib/notebook";
import {
  parseTeamDateKey,
  teamDateKey,
  TEAM_TIME_ZONE,
  teamWeekday,
  zonedDateTime,
} from "@/lib/timezone";

/** Seed window: Mon/Thu evenings through Dec 5, 2026 (inclusive end date).
 * Session 1 is Thu 2026-09-24 (first team meeting); Mon 2026-09-28 is Session 2.
 */
const SEED_FROM = { year: 2026, month: 9, day: 24 };
const SEED_THROUGH = { year: 2026, month: 12, day: 5 };
const EVENING_START_HOUR = 18;
const EVENING_END_HOUR = 20;

export { NOTEBOOK_SECTION_LABELS, isNotebookKind };
export type { NotebookKind };

export function listSeedSlots() {
  const slots: {
    dateKey: string;
    startsAt: Date;
    endsAt: Date;
    seedKey: string;
    sessionNumber: number;
  }[] = [];
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
        // "et" distinguishes from earlier Pacific seeds (`mon-thu:DATE`).
        seedKey: `mon-thu-et:${dateKey}`,
        sessionNumber: slots.length + 1,
      });
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }

  return slots;
}

function legacySeedKey(dateKey: string) {
  return `mon-thu:${dateKey}`;
}

/**
 * Insert Mon/Thu Eastern evening meetings. Safe to re-run:
 * - new installs get correct America/New_York times + session numbers
 * - DBs that already seeded Pacific (`mon-thu:DATE`) are rewritten to Eastern
 *   times and renamed to `mon-thu-et:DATE`
 * - existing `mon-thu-et` rows get times / session numbers corrected if needed
 */
export async function ensureRecurringMeetings() {
  const slots = listSeedSlots();
  if (slots.length === 0) {
    return;
  }

  const db = getDb();

  for (const slot of slots) {
    const now = new Date();
    const legacyKey = legacySeedKey(slot.dateKey);

    const existing = await db
      .select({
        id: meeting.id,
        seedKey: meeting.seedKey,
      })
      .from(meeting)
      .where(inArray(meeting.seedKey, [slot.seedKey, legacyKey]));

    const easternRow = existing.find((row) => row.seedKey === slot.seedKey);
    const legacyRow = existing.find((row) => row.seedKey === legacyKey);

    if (easternRow) {
      await db
        .update(meeting)
        .set({
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          sessionNumber: slot.sessionNumber,
          updatedAt: now,
        })
        .where(eq(meeting.id, easternRow.id));

      if (legacyRow) {
        const [{ attendeeCount }] = await db
          .select({ attendeeCount: sql<number>`count(*)::int` })
          .from(meetingAttendee)
          .where(eq(meetingAttendee.meetingId, legacyRow.id));
        const [{ noteCount }] = await db
          .select({ noteCount: sql<number>`count(*)::int` })
          .from(meetingNote)
          .where(eq(meetingNote.meetingId, legacyRow.id));
        if (attendeeCount === 0 && noteCount === 0) {
          await db.delete(meeting).where(eq(meeting.id, legacyRow.id));
        } else {
          await db
            .update(meeting)
            .set({
              startsAt: slot.startsAt,
              endsAt: slot.endsAt,
              sessionNumber: slot.sessionNumber,
              updatedAt: now,
            })
            .where(eq(meeting.id, legacyRow.id));
        }
      }
      continue;
    }

    if (legacyRow) {
      await db
        .update(meeting)
        .set({
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          seedKey: slot.seedKey,
          sessionNumber: slot.sessionNumber,
          updatedAt: now,
        })
        .where(eq(meeting.id, legacyRow.id));
      continue;
    }
  }

  await db
    .insert(meeting)
    .values(
      slots.map((slot) => ({
        id: crypto.randomUUID(),
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        title: "Team meeting",
        sessionNumber: slot.sessionNumber,
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
      sessionNumber: true,
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
      sessionNumber: meeting.sessionNumber,
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

  const notes = row.notes.map((note) => ({
    id: note.id,
    kind: (isNotebookKind(note.kind) ? note.kind : "progress") as NotebookKind,
    body: note.body,
    createdAt: note.createdAt,
    authorName: note.author.name,
    authorId: note.author.id,
  }));

  return {
    id: row.id,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    title: row.title,
    summary: row.summary,
    sessionNumber: row.sessionNumber,
    seedKey: row.seedKey,
    attendanceRecordedAt: row.attendanceRecordedAt,
    attendanceRecordedBy: row.attendanceRecordedBy,
    // Attendance UI is students-only; keep non-student rows in DB but hide them.
    attendees: row.attendees
      .map((item) => item.user)
      .filter((person) => person.role === "student")
      .sort((left, right) => left.name.localeCompare(right.name)),
    notes,
    progress: notes.filter((note) => note.kind === "progress"),
    actions: notes.filter((note) => note.kind === "action"),
    lessons: notes.filter((note) => note.kind === "lesson"),
  };
}

async function nextSessionNumber() {
  const [row] = await getDb().select({ value: max(meeting.sessionNumber) }).from(meeting);
  return (row?.value ?? 0) + 1;
}

export async function createOneOffMeeting(input: {
  userId: string;
  dateKey: string;
  title?: string;
  summary?: string;
  startHour?: number;
  endHour?: number;
  sessionNumber?: number;
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
  const sessionNumber =
    typeof input.sessionNumber === "number" && input.sessionNumber > 0
      ? Math.floor(input.sessionNumber)
      : await nextSessionNumber();

  await getDb().insert(meeting).values({
    id,
    startsAt,
    endsAt,
    title,
    summary,
    sessionNumber,
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

  // Only students may be marked present. Coaches/parents (and other roles) are ignored.
  const unique = [...new Set(input.attendeeIds.filter(Boolean))];
  let allowed: string[] = [];
  if (unique.length > 0) {
    const rows = await getDb()
      .select({ id: user.id })
      .from(user)
      .where(and(inArray(user.id, unique), eq(user.role, "student")));
    allowed = rows.map((row) => row.id);
  }

  const recordedAt = new Date();
  await getDb().transaction(async (tx) => {
    // Replace student rows only — leave any historical non-student checkmarks untouched.
    const priorStudents = await tx
      .select({ userId: meetingAttendee.userId })
      .from(meetingAttendee)
      .innerJoin(user, eq(meetingAttendee.userId, user.id))
      .where(and(eq(meetingAttendee.meetingId, input.meetingId), eq(user.role, "student")));
    if (priorStudents.length > 0) {
      await tx.delete(meetingAttendee).where(
        and(
          eq(meetingAttendee.meetingId, input.meetingId),
          inArray(
            meetingAttendee.userId,
            priorStudents.map((row) => row.userId),
          ),
        ),
      );
    }
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
  kind: NotebookKind;
}) {
  const body = input.body.trim();
  if (!body) {
    return { error: "Write something first." };
  }
  if (body.length > 4000) {
    return { error: "Use a shorter note." };
  }
  if (!isNotebookKind(input.kind)) {
    return { error: "Pick a notebook section." };
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
    kind: input.kind,
    body,
    authorId: input.authorId,
  });

  return { id };
}

export async function updateMeetingSummary(input: {
  meetingId: string;
  title?: string;
  summary?: string;
  sessionNumber?: number | null;
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
  if (
    input.sessionNumber !== undefined &&
    input.sessionNumber !== null &&
    (!Number.isFinite(input.sessionNumber) || input.sessionNumber < 1)
  ) {
    return { error: "Session number must be 1 or higher." };
  }

  await getDb()
    .update(meeting)
    .set({
      ...(title !== undefined ? { title: title || null } : {}),
      ...(summary !== undefined ? { summary: summary || null } : {}),
      ...(input.sessionNumber !== undefined
        ? { sessionNumber: input.sessionNumber === null ? null : Math.floor(input.sessionNumber) }
        : {}),
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
      sessionNumber: meeting.sessionNumber,
    })
    .from(meeting)
    .where(gte(meeting.startsAt, new Date(Date.now() - 12 * 60 * 60 * 1000)))
    .orderBy(asc(meeting.startsAt))
    .limit(limit);
}

/** Schedule-only rows for the public .ics feed (no notes, attendance, or summary). */
export async function listMeetingsForCalendar() {
  return getDb()
    .select({
      id: meeting.id,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      title: meeting.title,
      sessionNumber: meeting.sessionNumber,
      updatedAt: meeting.updatedAt,
    })
    .from(meeting)
    .orderBy(asc(meeting.startsAt));
}

export async function listRecentMeetings(limit = 40) {
  return getDb()
    .select({
      id: meeting.id,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      title: meeting.title,
      sessionNumber: meeting.sessionNumber,
    })
    .from(meeting)
    .orderBy(desc(meeting.startsAt))
    .limit(limit);
}

/** True when a meeting has notebook content (not just a calendar shell). */
function meetingHasNotebookContent(row: {
  summary: string | null;
  attendanceRecordedAt: Date | null;
  notes: { kind: string }[];
  attendees: { userId: string }[];
  media: { id: string }[];
  journalEntries: { id: string }[];
}) {
  return (
    row.notes.length > 0 ||
    row.attendees.length > 0 ||
    row.media.length > 0 ||
    row.journalEntries.length > 0 ||
    Boolean(row.summary?.trim()) ||
    row.attendanceRecordedAt != null
  );
}

/** Sessions for the engineering notebook index (newest first).
 * Empty calendar shells (no notes, attendance, media, summary, or related journal) are omitted.
 * Includes notebook body content for the journal timeline (read-only inline view).
 */
export async function listNotebookSessions(limit = 40) {
  const rows = await getDb().query.meeting.findMany({
    orderBy: (table, { desc: orderDesc }) => [orderDesc(table.startsAt)],
    with: {
      notes: {
        orderBy: (table, { asc: orderAsc }) => [orderAsc(table.createdAt)],
        with: { author: { columns: { id: true, name: true } } },
      },
      attendees: {
        with: { user: { columns: { id: true, name: true, role: true } } },
      },
      media: {
        orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
        with: { uploader: { columns: { id: true, name: true } } },
      },
      journalEntries: { columns: { id: true } },
    },
  });

  return rows
    .filter(meetingHasNotebookContent)
    .slice(0, limit)
    .map((row) => {
      const notes = row.notes.map((note) => ({
        id: note.id,
        kind: (isNotebookKind(note.kind) ? note.kind : "progress") as NotebookKind,
        body: note.body,
        createdAt: note.createdAt,
        authorName: note.author.name,
      }));
      const progress = notes.filter((note) => note.kind === "progress");
      const actions = notes.filter((note) => note.kind === "action");
      const lessons = notes.filter((note) => note.kind === "lesson");
      // Attendance UI is students-only; keep non-student rows in DB but hide them.
      const attendees = row.attendees
        .map((item) => item.user)
        .filter((person) => person.role === "student")
        .sort((left, right) => left.name.localeCompare(right.name));
      const media = row.media.map((item) => ({
        id: item.id,
        contentType: item.contentType,
        caption: item.caption,
        createdAt: item.createdAt,
        uploaderName: item.uploader.name,
      }));
      return {
        id: row.id,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        title: row.title,
        summary: row.summary,
        sessionNumber: row.sessionNumber,
        attendeeCount: attendees.length,
        progressCount: progress.length,
        actionCount: actions.length,
        lessonCount: lessons.length,
        attendees,
        progress,
        actions,
        lessons,
        media,
      };
    });
}

export { TEAM_TIME_ZONE, EVENING_START_HOUR, EVENING_END_HOUR };
