import { and, count, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { mission, missionAssignment, missionNote, missionStatusEvent, user } from "@/db/schema";
import { findTodayMeeting, meetingExists } from "@/lib/meetings";
import { toMissionStatus, type MissionStatus } from "@/lib/mission-status";

export type BoardMission = {
  id: number;
  number: number;
  name: string;
  status: MissionStatus;
  statusUpdatedAt: Date | null;
  statusUpdatedByName: string | null;
  assignees: { id: string; name: string }[];
  noteCount: number;
};

/** All missions in number order, with status, who's on each, and note counts. */
export async function listMissionBoard(): Promise<BoardMission[]> {
  const [rows, noteCounts] = await Promise.all([
    getDb().query.mission.findMany({
      orderBy: (table, { asc: orderAsc }) => [orderAsc(table.number)],
      with: {
        assignments: {
          with: { user: { columns: { id: true, name: true, role: true } } },
        },
      },
    }),
    getDb()
      .select({ missionId: missionNote.missionId, value: count() })
      .from(missionNote)
      .groupBy(missionNote.missionId),
  ]);

  const updaterIds = [
    ...new Set(rows.map((row) => row.statusUpdatedById).filter((id): id is string => !!id)),
  ];
  const updaters = new Map(
    updaterIds.length > 0
      ? (
          await getDb()
            .select({ id: user.id, name: user.name })
            .from(user)
            .where(inArray(user.id, updaterIds))
        ).map((person) => [person.id, person.name])
      : [],
  );
  const notesByMission = new Map(noteCounts.map((row) => [row.missionId, row.value]));

  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    name: row.name,
    status: toMissionStatus(row.status),
    statusUpdatedAt: row.statusUpdatedAt,
    statusUpdatedByName: row.statusUpdatedById ? updaters.get(row.statusUpdatedById) ?? null : null,
    assignees: row.assignments
      .map((item) => item.user)
      .filter((person) => person.role === "student")
      .map((person) => ({ id: person.id, name: person.name }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    noteCount: notesByMission.get(row.id) ?? 0,
  }));
}

/** Notes for one mission, newest first. */
export async function listMissionNotes(missionId: number) {
  const rows = await getDb().query.missionNote.findMany({
    where: (table, { eq: equals }) => equals(table.missionId, missionId),
    orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
    with: {
      author: { columns: { id: true, name: true } },
      meeting: { columns: { id: true, sessionNumber: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.createdAt,
    authorName: row.author.name,
    meetingId: row.meeting?.id ?? null,
    sessionNumber: row.meeting?.sessionNumber ?? null,
  }));
}

export async function countStatusEvents() {
  const [row] = await getDb().select({ value: count() }).from(missionStatusEvent);
  return row?.value ?? 0;
}

async function missionById(missionId: number) {
  if (!Number.isInteger(missionId) || missionId <= 0) {
    return null;
  }
  const [row] = await getDb()
    .select({ id: mission.id, name: mission.name, status: mission.status })
    .from(mission)
    .where(eq(mission.id, missionId))
    .limit(1);
  return row ?? null;
}

/** The meeting to file an update under: the one given, else today's if there is one. */
async function resolveMeetingId(meetingId: string | null | undefined) {
  if (meetingId) {
    return (await meetingExists(meetingId)) ? meetingId : null;
  }
  return (await findTodayMeeting())?.id ?? null;
}

export async function setMissionStatus(input: {
  missionId: number;
  status: MissionStatus;
  userId: string;
  meetingId?: string | null;
}) {
  const row = await missionById(input.missionId);
  if (!row) {
    return { error: "That mission is missing." };
  }
  const meetingId = await resolveMeetingId(input.meetingId);
  const now = new Date();
  await getDb().transaction(async (tx) => {
    await tx
      .update(mission)
      .set({ status: input.status, statusUpdatedAt: now, statusUpdatedById: input.userId })
      .where(eq(mission.id, input.missionId));
    await tx.insert(missionStatusEvent).values({
      id: crypto.randomUUID(),
      missionId: input.missionId,
      meetingId,
      status: input.status,
      userId: input.userId,
      createdAt: now,
    });
  });
  return { ok: true as const, missionName: row.name };
}

async function isStudent(userId: string) {
  const [row] = await getDb()
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row?.role === "student";
}

export async function addMissionAssignment(input: {
  missionId: number;
  userId: string;
  assignedById: string;
}) {
  if (!(await missionById(input.missionId))) {
    return { error: "That mission is missing." };
  }
  if (!(await isStudent(input.userId))) {
    return { error: "Only students can be on a mission." };
  }
  await getDb()
    .insert(missionAssignment)
    .values({ missionId: input.missionId, userId: input.userId, assignedById: input.assignedById })
    .onConflictDoNothing();
  return { ok: true as const };
}

export async function removeMissionAssignment(input: { missionId: number; userId: string }) {
  await getDb()
    .delete(missionAssignment)
    .where(
      and(
        eq(missionAssignment.missionId, input.missionId),
        eq(missionAssignment.userId, input.userId),
      ),
    );
  return { ok: true as const };
}

export async function addMissionNote(input: {
  missionId: number;
  body: string;
  authorId: string;
  meetingId?: string | null;
}) {
  const body = input.body.trim();
  if (!body) {
    return { error: "Write something first." };
  }
  if (body.length > 4000) {
    return { error: "Use a shorter note." };
  }
  if (!(await missionById(input.missionId))) {
    return { error: "That mission is missing." };
  }
  const id = crypto.randomUUID();
  await getDb().insert(missionNote).values({
    id,
    missionId: input.missionId,
    meetingId: await resolveMeetingId(input.meetingId),
    body,
    authorId: input.authorId,
  });
  return { id };
}
