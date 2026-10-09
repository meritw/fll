import { and, asc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { pybricksLicense, user } from "@/db/schema";

/** Rolling Sparks class-year-10 team pack (10 seats). Last seat is coach-reserved. */
const STUDENT_CODES = [
  "PYBRICKS261008-3725-91119_LICENSE_blocks-class-year-10_v1_meritw@gmail.com_4_Z3G3W4",
  "PYBRICKS261008-3725-91119_LICENSE_blocks-class-year-10_v1_meritw@gmail.com_1_CBQGG5",
  "PYBRICKS261008-3725-91119_LICENSE_blocks-class-year-10_v1_meritw@gmail.com_5_M22TG2",
  "PYBRICKS261008-3725-91119_LICENSE_blocks-class-year-10_v1_meritw@gmail.com_6_BGPGG8",
  "PYBRICKS261008-3725-91119_LICENSE_blocks-class-year-10_v1_meritw@gmail.com_2_4C2MSP",
  "PYBRICKS261008-3725-91119_LICENSE_blocks-class-year-10_v1_meritw@gmail.com_3_HRQHW4",
  "PYBRICKS261008-3725-91119_LICENSE_blocks-class-year-10_v1_meritw@gmail.com_9_8238W4",
  "PYBRICKS261008-3725-91119_LICENSE_blocks-class-year-10_v1_meritw@gmail.com_10_MZCCSR",
  "PYBRICKS261008-3725-91119_LICENSE_blocks-class-year-10_v1_meritw@gmail.com_7_CHSQGS",
] as const;

const COACH_RESERVED_CODE =
  "PYBRICKS261008-3725-91119_LICENSE_blocks-class-year-10_v1_meritw@gmail.com_8_GQMBPZ";

const COACH_RESERVED_USERNAME = "bob";

function seatId(seatIndex: number) {
  return `pybricks-seat-${seatIndex}`;
}

/** Insert the 10 team seats if missing. Does not reassign existing holders. */
export async function ensurePybricksLicenses() {
  const db = getDb();
  const now = new Date();

  const studentRows = STUDENT_CODES.map((code, index) => ({
    id: seatId(index + 1),
    code,
    seatKind: "student" as const,
    seatIndex: index + 1,
    createdAt: now,
  }));

  await db
    .insert(pybricksLicense)
    .values([
      ...studentRows,
      {
        id: seatId(10),
        code: COACH_RESERVED_CODE,
        seatKind: "coach_reserved",
        seatIndex: 10,
        createdAt: now,
      },
    ])
    .onConflictDoNothing({ target: pybricksLicense.seatIndex });

  await assignStudentSeats();
  await assignCoachReservedSeat();
}

async function assignStudentSeats() {
  const db = getDb();
  const students = await db
    .select({ id: user.id, username: user.username })
    .from(user)
    .where(eq(user.role, "student"))
    .orderBy(asc(user.username));

  const seats = await db
    .select({
      id: pybricksLicense.id,
      seatIndex: pybricksLicense.seatIndex,
      assignedUserId: pybricksLicense.assignedUserId,
    })
    .from(pybricksLicense)
    .where(eq(pybricksLicense.seatKind, "student"))
    .orderBy(asc(pybricksLicense.seatIndex));

  const alreadyAssigned = new Set(
    seats.map((s) => s.assignedUserId).filter((id): id is string => Boolean(id)),
  );

  const seatsNeedingUser = seats.filter((s) => !s.assignedUserId);
  const studentsNeedingSeat = students.filter((s) => !alreadyAssigned.has(s.id));

  const now = new Date();
  const pairCount = Math.min(seatsNeedingUser.length, studentsNeedingSeat.length);
  for (let i = 0; i < pairCount; i++) {
    const seat = seatsNeedingUser[i];
    const student = studentsNeedingSeat[i];
    await db
      .update(pybricksLicense)
      .set({ assignedUserId: student.id, assignedAt: now })
      .where(eq(pybricksLicense.id, seat.id));
  }

  if (studentsNeedingSeat.length > seatsNeedingUser.length) {
    const shortfall = studentsNeedingSeat.length - seatsNeedingUser.length;
    console.warn(
      `Pybricks licenses: ${shortfall} student(s) have no free seat (only ${STUDENT_CODES.length} student codes).`,
    );
  }
}

async function assignCoachReservedSeat() {
  const db = getDb();
  const [seat] = await db
    .select({
      id: pybricksLicense.id,
      assignedUserId: pybricksLicense.assignedUserId,
    })
    .from(pybricksLicense)
    .where(eq(pybricksLicense.seatKind, "coach_reserved"))
    .limit(1);
  if (!seat || seat.assignedUserId) {
    return;
  }

  const [bob] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, COACH_RESERVED_USERNAME))
    .limit(1);
  if (!bob) {
    return;
  }

  await db
    .update(pybricksLicense)
    .set({ assignedUserId: bob.id, assignedAt: new Date() })
    .where(eq(pybricksLicense.id, seat.id));
}

export type LicenseForViewer = {
  code: string;
  seatKind: "student" | "coach_reserved";
  seatIndex: number;
};

/** Stable per-user code after ensure/assignment. Team members only see their own. */
export async function getLicenseForUser(userId: string): Promise<LicenseForViewer | null> {
  await ensurePybricksLicenses();

  const [row] = await getDb()
    .select({
      code: pybricksLicense.code,
      seatKind: pybricksLicense.seatKind,
      seatIndex: pybricksLicense.seatIndex,
    })
    .from(pybricksLicense)
    .where(eq(pybricksLicense.assignedUserId, userId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    code: row.code,
    seatKind: row.seatKind === "coach_reserved" ? "coach_reserved" : "student",
    seatIndex: row.seatIndex,
  };
}

export async function listLicenseAssignments() {
  await ensurePybricksLicenses();

  return getDb()
    .select({
      seatIndex: pybricksLicense.seatIndex,
      seatKind: pybricksLicense.seatKind,
      code: pybricksLicense.code,
      username: user.username,
      name: user.name,
      role: user.role,
    })
    .from(pybricksLicense)
    .leftJoin(user, eq(pybricksLicense.assignedUserId, user.id))
    .orderBy(asc(pybricksLicense.seatIndex));
}

/** Last 6 characters of a code (safe for PR summaries). */
export function codeTail(code: string) {
  return code.slice(-6);
}

export async function countUnassignedStudentSeats() {
  const open = await getDb()
    .select({ id: pybricksLicense.id })
    .from(pybricksLicense)
    .where(and(eq(pybricksLicense.seatKind, "student"), isNull(pybricksLicense.assignedUserId)));
  return open.length;
}
