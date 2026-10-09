import { and, count, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  mission,
  missionAssignment,
  missionNote,
  missionStatusEvent,
  user,
} from "@/db/schema";
import {
  isMissionStatus,
  isWorking,
  type MissionStatus,
} from "@/lib/mission-status";
import { findMeetingForDay } from "@/lib/meetings";
import { teamDateKey } from "@/lib/timezone";

async function resolveMeetingId(meetingId?: string | null) {
  if (meetingId) {
    return meetingId;
  }
  const today = await findMeetingForDay(teamDateKey(new Date()));
  return today?.id ?? null;
}

export async function listMissionBoard() {
  const rows = await getDb().query.mission.findMany({
    orderBy: (table, { asc: orderAsc }) => [orderAsc(table.number)],
    with: {
      statusUpdatedBy: { columns: { id: true, name: true } },
      assignments: {
        with: { user: { columns: { id: true, name: true, role: true } } },
      },
      notes: { columns: { id: true } },
    },
  });

  return rows.map((row) => {
    const status = (isMissionStatus(row.status) ? row.status : "none") as MissionStatus;
    const assignees = row.assignments
      .map((item) => item.user)
      .filter((person) => person.role === "student")
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((person) => ({ id: person.id, name: person.name }));
    return {
      id: row.id,
      number: row.number,
      name: row.name,
      status,
      statusUpdatedAt: row.statusUpdatedAt,
      statusUpdatedBy: row.statusUpdatedBy
        ? { id: row.statusUpdatedBy.id, name: row.statusUpdatedBy.name }
        : null,
      assignees,
      noteCount: row.notes.length,
      working: isWorking(status),
    };
  });
}

export async function getMissionDetail(number: number) {
  const row = await getDb().query.mission.findFirst({
    where: (table, { eq: equals }) => equals(table.number, number),
    with: {
      statusUpdatedBy: { columns: { id: true, name: true } },
      assignments: {
        with: { user: { columns: { id: true, name: true, role: true } } },
      },
      notes: {
        orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
        with: {
          author: { columns: { id: true, name: true } },
          meeting: { columns: { id: true, sessionNumber: true, startsAt: true } },
        },
      },
    },
  });
  if (!row) {
    return null;
  }

  const status = (isMissionStatus(row.status) ? row.status : "none") as MissionStatus;
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    status,
    statusUpdatedAt: row.statusUpdatedAt,
    statusUpdatedBy: row.statusUpdatedBy
      ? { id: row.statusUpdatedBy.id, name: row.statusUpdatedBy.name }
      : null,
    assignees: row.assignments
      .map((item) => item.user)
      .filter((person) => person.role === "student")
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((person) => ({ id: person.id, name: person.name })),
    notes: row.notes.map((note) => ({
      id: note.id,
      body: note.body,
      createdAt: note.createdAt,
      authorName: note.author.name,
      authorId: note.author.id,
      meetingId: note.meeting?.id ?? null,
      sessionNumber: note.meeting?.sessionNumber ?? null,
      meetingStartsAt: note.meeting?.startsAt ?? null,
    })),
  };
}

export async function setMissionStatus(input: {
  missionId: number;
  status: MissionStatus;
  userId: string;
  meetingId?: string | null;
}) {
  if (!isMissionStatus(input.status)) {
    return { error: "Pick a valid status." };
  }

  const [existing] = await getDb()
    .select({ id: mission.id, status: mission.status })
    .from(mission)
    .where(eq(mission.id, input.missionId))
    .limit(1);
  if (!existing) {
    return { error: "That mission is missing." };
  }
  if (existing.status === input.status) {
    return { ok: true as const, unchanged: true as const };
  }

  const meetingId = await resolveMeetingId(input.meetingId);
  const now = new Date();
  const eventId = crypto.randomUUID();

  await getDb().transaction(async (tx) => {
    await tx
      .update(mission)
      .set({
        status: input.status,
        statusUpdatedAt: now,
        statusUpdatedById: input.userId,
      })
      .where(eq(mission.id, input.missionId));
    await tx.insert(missionStatusEvent).values({
      id: eventId,
      missionId: input.missionId,
      meetingId,
      status: input.status,
      userId: input.userId,
      createdAt: now,
    });
  });

  return { ok: true as const, unchanged: false as const };
}

export async function addMissionAssignment(input: {
  missionId: number;
  userId: string;
  assignedById: string;
}) {
  const [person] = await getDb()
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1);
  if (!person || person.role !== "student") {
    return { error: "Only students can be assigned to missions." };
  }

  const [existingMission] = await getDb()
    .select({ id: mission.id })
    .from(mission)
    .where(eq(mission.id, input.missionId))
    .limit(1);
  if (!existingMission) {
    return { error: "That mission is missing." };
  }

  await getDb()
    .insert(missionAssignment)
    .values({
      missionId: input.missionId,
      userId: input.userId,
      assignedById: input.assignedById,
    })
    .onConflictDoNothing();

  return { ok: true as const };
}

export async function removeMissionAssignment(input: {
  missionId: number;
  userId: string;
}) {
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

  const [existingMission] = await getDb()
    .select({ id: mission.id })
    .from(mission)
    .where(eq(mission.id, input.missionId))
    .limit(1);
  if (!existingMission) {
    return { error: "That mission is missing." };
  }

  const meetingId = await resolveMeetingId(input.meetingId);
  const id = crypto.randomUUID();
  await getDb().insert(missionNote).values({
    id,
    missionId: input.missionId,
    meetingId,
    body,
    authorId: input.authorId,
  });

  return { id };
}

/** Map of student userId → how many missions they are on. */
export async function missionLoadByStudent() {
  const rows = await getDb()
    .select({
      userId: missionAssignment.userId,
      value: count(),
    })
    .from(missionAssignment)
    .groupBy(missionAssignment.userId);

  return new Map(rows.map((row) => [row.userId, Number(row.value)]));
}

export async function countMissionStatusEvents() {
  const [row] = await getDb().select({ value: count() }).from(missionStatusEvent);
  return Number(row?.value ?? 0);
}

export async function missionStatusCounts(board: { status: MissionStatus }[]) {
  const counts = { none: 0, trying: 0, some: 0, every: 0 };
  for (const item of board) {
    counts[item.status] += 1;
  }
  return counts;
}
