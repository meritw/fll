import { and, asc, desc, eq, max, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  meeting,
  meetingAttendee,
  meetingNote,
  user,
} from "@/db/schema";
import { isNotebookKind, NOTEBOOK_SECTION_LABELS, type NotebookKind } from "@/lib/notebook";
import {
  isMissionStatus,
  type MissionStatus,
} from "@/lib/mission-status";
import {
  parseTeamDateKey,
  teamDateKey,
  TEAM_TIME_ZONE,
  zonedDateTime,
} from "@/lib/timezone";

const MEETING_DURATION_MS = 2 * 60 * 60 * 1000;

export { NOTEBOOK_SECTION_LABELS, isNotebookKind };
export type { NotebookKind };

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
      dayKey: true,
      attendanceRecordedAt: true,
    },
  });
}

/** Find a meeting on a team-time-zone day by day_key or startsAt window. */
export async function findMeetingForDay(dayKey: string) {
  const parsed = parseTeamDateKey(dayKey);
  if (!parsed) {
    return null;
  }

  const dayStart = zonedDateTime(parsed.year, parsed.month, parsed.day, 0, 0);
  const next = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const rows = await getDb()
    .select({
      id: meeting.id,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      title: meeting.title,
      summary: meeting.summary,
      sessionNumber: meeting.sessionNumber,
      dayKey: meeting.dayKey,
      attendanceRecordedAt: meeting.attendanceRecordedAt,
    })
    .from(meeting)
    .where(
      sql`(${meeting.dayKey} = ${dayKey} OR (${meeting.startsAt} >= ${dayStart} AND ${meeting.startsAt} < ${next}))`,
    )
    .orderBy(asc(meeting.startsAt))
    .limit(1);

  return rows[0] ?? null;
}

async function nextSessionNumber() {
  const [row] = await getDb().select({ value: max(meeting.sessionNumber) }).from(meeting);
  return (row?.value ?? 0) + 1;
}

/** Start or return today's live meeting. Race-safe via day_key unique. */
export async function ensureTodayMeeting(userId: string) {
  const dayKey = teamDateKey(new Date());
  const existing = await findMeetingForDay(dayKey);
  if (existing) {
    return { id: existing.id, created: false as const };
  }

  const now = new Date();
  const id = crypto.randomUUID();
  const sessionNumber = await nextSessionNumber();

  await getDb()
    .insert(meeting)
    .values({
      id,
      dayKey,
      startsAt: now,
      endsAt: new Date(now.getTime() + MEETING_DURATION_MS),
      title: "Team meeting",
      sessionNumber,
      createdById: userId,
    })
    .onConflictDoNothing({ target: meeting.dayKey });

  const row = await findMeetingForDay(dayKey);
  if (!row) {
    throw new Error("Could not start today's meeting.");
  }
  return { id: row.id, created: row.id === id };
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
      media: {
        orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
        with: { uploader: { columns: { id: true, name: true } } },
      },
      missionNotes: {
        orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
        with: {
          author: { columns: { id: true, name: true } },
          mission: { columns: { id: true, number: true, name: true } },
        },
      },
      missionStatusEvents: {
        orderBy: (table, { asc: orderAsc }) => [orderAsc(table.createdAt)],
        with: {
          mission: { columns: { id: true, number: true, name: true } },
          user: { columns: { id: true, name: true } },
        },
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
    dayKey: row.dayKey,
    attendanceRecordedAt: row.attendanceRecordedAt,
    attendanceRecordedBy: row.attendanceRecordedBy,
    attendees: row.attendees
      .map((item) => item.user)
      .filter((person) => person.role === "student")
      .sort((left, right) => left.name.localeCompare(right.name)),
    notes,
    progress: notes.filter((note) => note.kind === "progress"),
    actions: notes.filter((note) => note.kind === "action"),
    lessons: notes.filter((note) => note.kind === "lesson"),
    media: row.media.map((item) => ({
      id: item.id,
      contentType: item.contentType,
      caption: item.caption,
      fileName: item.fileName,
      createdAt: item.createdAt,
      uploaderId: item.uploaderId,
      uploaderName: item.uploader.name,
    })),
    missionNotes: row.missionNotes.map((note) => ({
      id: note.id,
      body: note.body,
      createdAt: note.createdAt,
      authorName: note.author.name,
      missionId: note.mission.id,
      missionNumber: note.mission.number,
      missionName: note.mission.name,
    })),
    missionStatusEvents: row.missionStatusEvents.map((event) => ({
      id: event.id,
      status: (isMissionStatus(event.status) ? event.status : "none") as MissionStatus,
      createdAt: event.createdAt,
      userName: event.user?.name ?? null,
      missionId: event.mission.id,
      missionNumber: event.mission.number,
      missionName: event.mission.name,
    })),
  };
}

/** Toggle one student present/absent. Students only. */
export async function setAttendance(input: {
  meetingId: string;
  userId: string;
  present: boolean;
  recordedById: string;
}) {
  const [existing] = await getDb()
    .select({ id: meeting.id })
    .from(meeting)
    .where(eq(meeting.id, input.meetingId))
    .limit(1);
  if (!existing) {
    return { error: "That meeting is missing." };
  }

  const [person] = await getDb()
    .select({ id: user.id, name: user.name, role: user.role })
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1);
  if (!person || person.role !== "student") {
    return { error: "Only students can be marked present." };
  }

  const recordedAt = new Date();
  if (input.present) {
    await getDb()
      .insert(meetingAttendee)
      .values({ meetingId: input.meetingId, userId: input.userId })
      .onConflictDoNothing();
  } else {
    await getDb()
      .delete(meetingAttendee)
      .where(
        and(
          eq(meetingAttendee.meetingId, input.meetingId),
          eq(meetingAttendee.userId, input.userId),
        ),
      );
  }

  await getDb()
    .update(meeting)
    .set({
      attendanceRecordedById: input.recordedById,
      attendanceRecordedAt: recordedAt,
      updatedAt: recordedAt,
    })
    .where(eq(meeting.id, input.meetingId));

  return { ok: true as const, userName: person.name, present: input.present };
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

export async function listRecentMeetings(limit = 40) {
  return getDb()
    .select({
      id: meeting.id,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      title: meeting.title,
      sessionNumber: meeting.sessionNumber,
      dayKey: meeting.dayKey,
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
  missionNotes?: { id: string }[];
  missionStatusEvents?: { id: string }[];
}) {
  return (
    row.notes.length > 0 ||
    row.attendees.length > 0 ||
    row.media.length > 0 ||
    row.journalEntries.length > 0 ||
    (row.missionNotes?.length ?? 0) > 0 ||
    (row.missionStatusEvents?.length ?? 0) > 0 ||
    Boolean(row.summary?.trim()) ||
    row.attendanceRecordedAt != null
  );
}

/** Sessions for the journal timeline (newest first). Empty shells omitted. */
export async function listNotebookSessions(limit = 200) {
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
      missionNotes: {
        orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
        with: {
          author: { columns: { id: true, name: true } },
          mission: { columns: { id: true, number: true, name: true } },
        },
      },
      missionStatusEvents: {
        orderBy: (table, { asc: orderAsc }) => [orderAsc(table.createdAt)],
        with: {
          mission: { columns: { id: true, number: true, name: true } },
          user: { columns: { id: true, name: true } },
        },
      },
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
        dayKey: row.dayKey,
        attendeeCount: attendees.length,
        progressCount: progress.length,
        actionCount: actions.length,
        lessonCount: lessons.length,
        attendees,
        progress,
        actions,
        lessons,
        media,
        missionNotes: row.missionNotes.map((note) => ({
          id: note.id,
          body: note.body,
          createdAt: note.createdAt,
          authorName: note.author.name,
          missionId: note.mission.id,
          missionNumber: note.mission.number,
          missionName: note.mission.name,
        })),
        missionStatusEvents: row.missionStatusEvents.map((event) => ({
          id: event.id,
          status: (isMissionStatus(event.status) ? event.status : "none") as MissionStatus,
          createdAt: event.createdAt,
          userName: event.user?.name ?? null,
          missionId: event.mission.id,
          missionNumber: event.mission.number,
          missionName: event.mission.name,
        })),
      };
    });
}

export async function peekNextSessionNumber() {
  return nextSessionNumber();
}

export { TEAM_TIME_ZONE };
