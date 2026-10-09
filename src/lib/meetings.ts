import { and, asc, eq, gte, lt, max } from "drizzle-orm";

import { getDb } from "@/db";
import { meeting, meetingAttendee, meetingNote, user } from "@/db/schema";
import { toMissionStatus, type MissionStatus } from "@/lib/mission-status";
import { isNotebookKind, NOTEBOOK_SECTION_LABELS, type NotebookKind } from "@/lib/notebook";
import { parseTeamDateKey, teamDateKey, zonedDateTime } from "@/lib/timezone";

export { NOTEBOOK_SECTION_LABELS, isNotebookKind };
export type { NotebookKind };

/** Default length of a meeting started live from the journal. */
const LIVE_MEETING_HOURS = 2;
const DEFAULT_TITLE = "Team meeting";

export type SessionNote = {
  id: string;
  kind: NotebookKind;
  body: string;
  createdAt: Date;
  authorName: string;
};

export type SessionMedia = {
  id: string;
  contentType: string;
  caption: string | null;
  createdAt: Date;
  uploaderName: string;
  uploaderId: string;
};

export type SessionRobotUpdate = {
  missionId: number;
  missionNumber: number;
  missionName: string;
  status: MissionStatus;
};

export type SessionMissionNote = {
  id: string;
  body: string;
  createdAt: Date;
  authorName: string;
  missionNumber: number;
  missionName: string;
};

export type SessionOtherNote = {
  id: string;
  title: string | null;
  body: string;
  createdAt: Date;
  authorName: string;
};

export type SessionRecord = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  title: string | null;
  summary: string | null;
  sessionNumber: number | null;
  dayKey: string;
  attendees: { id: string; name: string }[];
  progress: SessionNote[];
  actions: SessionNote[];
  lessons: SessionNote[];
  otherNotes: SessionOtherNote[];
  media: SessionMedia[];
  robot: SessionRobotUpdate[];
  missionNotes: SessionMissionNote[];
};

function findSessionRows(where?: { id: string }) {
  return getDb().query.meeting.findMany({
    where: where ? (table, { eq: equals }) => equals(table.id, where.id) : undefined,
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
      journalEntries: {
        with: { author: { columns: { id: true, name: true } } },
      },
      missionNotes: {
        with: {
          author: { columns: { id: true, name: true } },
          mission: { columns: { id: true, number: true, name: true } },
        },
      },
      missionStatusEvents: {
        with: { mission: { columns: { id: true, number: true, name: true } } },
      },
    },
  });
}

type SessionRow = Awaited<ReturnType<typeof findSessionRows>>[number];

/** True when a meeting has content (not an empty shell). */
function hasContent(row: SessionRow) {
  return (
    row.notes.length > 0 ||
    row.attendees.length > 0 ||
    row.media.length > 0 ||
    row.journalEntries.length > 0 ||
    row.missionNotes.length > 0 ||
    row.missionStatusEvents.length > 0 ||
    Boolean(row.summary?.trim()) ||
    row.attendanceRecordedAt != null
  );
}

function toSessionRecord(row: SessionRow): SessionRecord {
  const notes: SessionNote[] = row.notes.map((note) => ({
    id: note.id,
    kind: isNotebookKind(note.kind) ? note.kind : "progress",
    body: note.body,
    createdAt: note.createdAt,
    authorName: note.author.name,
  }));

  // Latest status per mission at this meeting.
  const latest = new Map<number, { at: number; update: SessionRobotUpdate }>();
  for (const event of row.missionStatusEvents) {
    const at = event.createdAt.getTime();
    const prior = latest.get(event.missionId);
    if (!prior || prior.at <= at) {
      latest.set(event.missionId, {
        at,
        update: {
          missionId: event.mission.id,
          missionNumber: event.mission.number,
          missionName: event.mission.name,
          status: toMissionStatus(event.status),
        },
      });
    }
  }

  return {
    id: row.id,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    title: row.title,
    summary: row.summary,
    sessionNumber: row.sessionNumber,
    dayKey: teamDateKey(row.startsAt),
    // Attendance is students-only; keep non-student rows in DB but hide them.
    attendees: row.attendees
      .map((item) => item.user)
      .filter((person) => person.role === "student")
      .map((person) => ({ id: person.id, name: person.name }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    progress: notes.filter((note) => note.kind === "progress"),
    actions: notes.filter((note) => note.kind === "action"),
    lessons: notes.filter((note) => note.kind === "lesson"),
    // Milestones are their own timeline cards, so they are not repeated here.
    otherNotes: row.journalEntries
      .filter((entry) => !entry.milestone)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map((entry) => ({
        id: entry.id,
        title: entry.title,
        body: entry.body,
        createdAt: entry.createdAt,
        authorName: entry.author.name,
      })),
    media: row.media.map((item) => ({
      id: item.id,
      contentType: item.contentType,
      caption: item.caption,
      createdAt: item.createdAt,
      uploaderName: item.uploader.name,
      uploaderId: item.uploader.id,
    })),
    robot: [...latest.values()]
      .map((item) => item.update)
      .sort((left, right) => left.missionNumber - right.missionNumber),
    missionNotes: row.missionNotes
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map((note) => ({
        id: note.id,
        body: note.body,
        createdAt: note.createdAt,
        authorName: note.author.name,
        missionNumber: note.mission.number,
        missionName: note.mission.name,
      })),
  };
}

/** Meetings with content, newest first, shaped for the journal timeline. */
export async function listSessionRecords(limit = 200) {
  const rows = await findSessionRows();
  return rows.filter(hasContent).slice(0, limit).map(toSessionRecord);
}

/** One meeting's full record (empty meetings included), or null. */
export async function getSessionRecord(id: string) {
  const [row] = await findSessionRows({ id });
  return row ? toSessionRecord(row) : null;
}

/** Headline for a meeting card: a coach-set title, else the first progress note, else "Session N". */
export function sessionHeadline(record: SessionRecord) {
  const title = record.title?.trim();
  if (title && title !== DEFAULT_TITLE) {
    return title;
  }
  // Older meetings often only have general notes, so fall back to those.
  const other = record.otherNotes[0];
  const first = (record.progress[0]?.body ?? other?.title ?? other?.body)?.trim().split("\n")[0];
  if (first) {
    return first.length > 90 ? `${first.slice(0, 87).trimEnd()}…` : first;
  }
  return sessionLabel(record);
}

export function sessionLabel(record: { sessionNumber: number | null; title: string | null }) {
  return record.sessionNumber != null
    ? `Session ${record.sessionNumber}`
    : record.title?.trim() || "Session";
}

function dayBounds(dayKey: string) {
  const parsed = parseTeamDateKey(dayKey);
  if (!parsed) {
    return null;
  }
  const start = zonedDateTime(parsed.year, parsed.month, parsed.day, 0, 0);
  const next = new Date(start.getTime() + 36 * 60 * 60 * 1000);
  const nextKey = parseTeamDateKey(teamDateKey(next))!;
  const end = zonedDateTime(nextKey.year, nextKey.month, nextKey.day, 0, 0);
  return { start, end };
}

/** The meeting on a team-time-zone day (live-started or an older scheduled one), if any. */
export async function findMeetingForDay(dayKey: string) {
  const bounds = dayBounds(dayKey);
  if (!bounds) {
    return null;
  }
  const [row] = await getDb()
    .select({ id: meeting.id, sessionNumber: meeting.sessionNumber })
    .from(meeting)
    .where(and(gte(meeting.startsAt, bounds.start), lt(meeting.startsAt, bounds.end)))
    .orderBy(asc(meeting.startsAt))
    .limit(1);
  if (row) {
    return row;
  }
  const [byKey] = await getDb()
    .select({ id: meeting.id, sessionNumber: meeting.sessionNumber })
    .from(meeting)
    .where(eq(meeting.dayKey, dayKey))
    .limit(1);
  return byKey ?? null;
}

export function todayKey() {
  return teamDateKey(new Date());
}

export async function findTodayMeeting() {
  return findMeetingForDay(todayKey());
}

export async function nextSessionNumber() {
  const [row] = await getDb().select({ value: max(meeting.sessionNumber) }).from(meeting);
  return (row?.value ?? 0) + 1;
}

/**
 * Today's meeting, started now if there is none yet. `day_key` is unique, so two
 * people starting it at the same moment end up on the same meeting.
 */
export async function ensureTodayMeeting(userId: string) {
  const dayKey = todayKey();
  const existing = await findMeetingForDay(dayKey);
  if (existing) {
    return { id: existing.id, created: false };
  }

  const now = new Date();
  const id = crypto.randomUUID();
  const inserted = await getDb()
    .insert(meeting)
    .values({
      id,
      dayKey,
      startsAt: now,
      endsAt: new Date(now.getTime() + LIVE_MEETING_HOURS * 60 * 60 * 1000),
      title: DEFAULT_TITLE,
      sessionNumber: await nextSessionNumber(),
      createdById: userId,
    })
    .onConflictDoNothing({ target: meeting.dayKey })
    .returning({ id: meeting.id });
  if (inserted.length > 0) {
    return { id, created: true };
  }

  const [winner] = await getDb()
    .select({ id: meeting.id })
    .from(meeting)
    .where(eq(meeting.dayKey, dayKey))
    .limit(1);
  return { id: winner.id, created: false };
}

export async function meetingExists(id: string) {
  const [row] = await getDb()
    .select({ id: meeting.id })
    .from(meeting)
    .where(eq(meeting.id, id))
    .limit(1);
  return Boolean(row);
}

/** Mark one student here or away. Non-students are rejected. */
export async function setAttendance(input: {
  meetingId: string;
  userId: string;
  present: boolean;
  recordedById: string;
}) {
  if (!(await meetingExists(input.meetingId))) {
    return { error: "That meeting is missing." };
  }
  const [person] = await getDb()
    .select({ id: user.id, name: user.name, role: user.role })
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1);
  if (!person || person.role !== "student") {
    return { error: "Only students are on the attendance list." };
  }

  const recordedAt = new Date();
  await getDb().transaction(async (tx) => {
    if (input.present) {
      await tx
        .insert(meetingAttendee)
        .values({ meetingId: input.meetingId, userId: input.userId })
        .onConflictDoNothing();
    } else {
      await tx
        .delete(meetingAttendee)
        .where(
          and(
            eq(meetingAttendee.meetingId, input.meetingId),
            eq(meetingAttendee.userId, input.userId),
          ),
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

  return { ok: true as const, name: person.name };
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
    return { error: "Pick a kind of note." };
  }
  if (!(await meetingExists(input.meetingId))) {
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
