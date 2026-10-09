import { eq } from "drizzle-orm";

import { getDb } from "../src/db";
import {
  journalEntry,
  meeting,
  meetingAttendee,
  meetingNote,
  mission,
  missionAssignment,
  missionStatusEvent,
  seasonEvent,
} from "../src/db/schema";
import { createAccount } from "../src/lib/accounts";
import { bootstrap } from "../src/lib/bootstrap";

async function main() {
  await bootstrap();
  await createAccount({
    username: "ava",
    displayName: "Ava",
    password: "ava",
    role: "student",
  });
  await createAccount({
    username: "ben",
    displayName: "Ben",
    password: "ben",
    role: "student",
  });

  const db = getDb();
  const coach = await db.query.user.findFirst({
    where: (table, { eq: equals }) => equals(table.username, "bob"),
  });
  const ava = await db.query.user.findFirst({
    where: (table, { eq: equals }) => equals(table.username, "ava"),
  });
  const ben = await db.query.user.findFirst({
    where: (table, { eq: equals }) => equals(table.username, "ben"),
  });
  if (!coach || !ava || !ben) {
    throw new Error("Missing seeded users.");
  }

  const missions = await db.select().from(mission).orderBy(mission.number);
  const id = crypto.randomUUID();
  const starts = new Date("2026-10-08T22:00:00.000Z");

  await db.insert(meeting).values({
    id,
    startsAt: starts,
    endsAt: new Date(starts.getTime() + 2 * 3600 * 1000),
    title: "Team meeting",
    sessionNumber: 11,
    dayKey: "2026-10-08",
    createdById: coach.id,
    attendanceRecordedAt: starts,
    attendanceRecordedById: coach.id,
  });
  await db.insert(meetingAttendee).values([
    { meetingId: id, userId: ava.id },
    { meetingId: id, userId: ben.id },
  ]);
  await db.insert(meetingNote).values([
    {
      id: crypto.randomUUID(),
      meetingId: id,
      kind: "progress",
      body: "Got the arm to grab the sample on three out of five runs.",
      authorId: ava.id,
    },
    {
      id: crypto.randomUUID(),
      meetingId: id,
      kind: "lesson",
      body: "Slowing the turn before the approach keeps the robot straighter.",
      authorId: ben.id,
    },
    {
      id: crypto.randomUUID(),
      meetingId: id,
      kind: "action",
      body: "Tune the light sensor threshold for the line after the base.",
      authorId: ava.id,
    },
  ]);
  await db.insert(journalEntry).values({
    id: crypto.randomUUID(),
    title: "First consistent sample grab",
    body: "We finally grabbed the sample three times in a row. Big moment for the robot game.",
    authorId: ava.id,
    relatedMeetingId: id,
    milestone: true,
  });
  await db.insert(seasonEvent).values({
    id: crypto.randomUUID(),
    title: "Qualifier",
    dayKey: "2026-11-15",
    createdById: coach.id,
  });

  const m07 = missions.find((row) => row.number === 7) ?? missions[6];
  const m01 = missions[0];
  if (m07) {
    await db
      .update(mission)
      .set({
        status: "every",
        statusUpdatedAt: starts,
        statusUpdatedById: ava.id,
      })
      .where(eq(mission.id, m07.id));
    await db.insert(missionAssignment).values({
      missionId: m07.id,
      userId: ava.id,
      assignedById: ava.id,
    });
    await db.insert(missionStatusEvent).values({
      id: crypto.randomUUID(),
      missionId: m07.id,
      meetingId: id,
      status: "every",
      userId: ava.id,
      createdAt: starts,
    });
  }
  if (m01) {
    await db
      .update(mission)
      .set({
        status: "trying",
        statusUpdatedAt: starts,
        statusUpdatedById: ben.id,
      })
      .where(eq(mission.id, m01.id));
    await db.insert(missionAssignment).values({
      missionId: m01.id,
      userId: ben.id,
      assignedById: ben.id,
    });
  }

  console.log("seeded meeting", id);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
