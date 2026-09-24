import { asc, eq, inArray, max } from "drizzle-orm";

import { getDb } from "@/db";
import { mission, program, programVersion, versionMission } from "@/db/schema";
import { safeFileName } from "@/lib/format";
import { headProgramObject, isOwnedProgramKey, MAX_PROGRAM_BYTES } from "@/lib/storage";

export async function listMissions() {
  return getDb().select().from(mission).orderBy(asc(mission.number));
}

export async function listPrograms() {
  const rows = await getDb().query.program.findMany({
    orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
    with: {
      versions: {
        orderBy: (table, { desc: orderDesc }) => [orderDesc(table.versionNumber)],
        with: {
          versionMissions: {
            with: { mission: true },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const latest = row.versions[0];
    const missions = (latest?.versionMissions ?? [])
      .map((link) => link.mission)
      .sort((left, right) => left.number - right.number);
    return {
      id: row.id,
      name: row.name,
      versionCount: row.versions.length,
      latestVersionId: latest?.id ?? null,
      missions: missions.map((item) => ({
        id: item.id,
        number: item.number,
        name: item.name,
      })),
      latestMissionIds: missions.map((item) => item.id),
    };
  });
}

export async function getProgram(id: string) {
  const row = await getDb().query.program.findFirst({
    where: (table, { eq: equals }) => equals(table.id, id),
    with: {
      versions: {
        orderBy: (table, { desc: orderDesc }) => [orderDesc(table.versionNumber)],
        with: {
          uploadedBy: { columns: { name: true } },
          versionMissions: { with: { mission: true } },
        },
      },
    },
  });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    versions: row.versions.map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      note: version.note,
      fileName: version.fileName,
      createdAt: version.createdAt,
      uploadedByName: version.uploadedBy.name,
      missionIds: version.versionMissions.map((link) => link.missionId),
      missions: version.versionMissions
        .map((link) => link.mission)
        .sort((left, right) => left.number - right.number)
        .map((item) => ({ number: item.number, name: item.name })),
    })),
  };
}

export async function getVersionFile(id: string) {
  const [row] = await getDb()
    .select({
      objectKey: programVersion.blobPathname,
      fileName: programVersion.fileName,
    })
    .from(programVersion)
    .where(eq(programVersion.id, id))
    .limit(1);

  return row ?? null;
}

function cleanName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "Add a name." };
  }
  if (trimmed.length > 80) {
    return { error: "Use a shorter name." };
  }
  return { name: trimmed };
}

function cleanNote(note: string) {
  const trimmed = note.trim();
  if (!trimmed) {
    return { error: "Tell what you changed." };
  }
  if (trimmed.length > 500) {
    return { error: "Use a shorter note." };
  }
  return { note: trimmed };
}

async function keepKnownMissions(ids: number[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    return [];
  }
  const rows = await getDb()
    .select({ id: mission.id })
    .from(mission)
    .where(inArray(mission.id, unique));
  const allowed = new Set(rows.map((row) => row.id));
  return unique.filter((id) => allowed.has(id));
}

async function assertUploadedFile(objectKey: string, fileName: string, userId: string) {
  if (!fileName.toLowerCase().endsWith(".llsp3")) {
    return { error: "Choose a .llsp3 file." };
  }
  if (!isOwnedProgramKey(userId, objectKey)) {
    return { error: "The file did not upload. Try again." };
  }

  try {
    const meta = await headProgramObject(objectKey);
    if (!meta) {
      return { error: "File saving is not set up yet. Ask a coach." };
    }
    if (meta.size <= 0 || meta.size > MAX_PROGRAM_BYTES) {
      return { error: "That file is too large." };
    }
    return { key: objectKey, fileName: safeFileName(fileName) };
  } catch (error) {
    console.error("Storage lookup failed", error);
    return { error: "The file did not upload. Try again." };
  }
}

export async function renameProgram(programId: string, name: string) {
  const cleaned = cleanName(name);
  if ("error" in cleaned) {
    return cleaned;
  }

  const [existing] = await getDb()
    .select({ id: program.id })
    .from(program)
    .where(eq(program.id, programId))
    .limit(1);
  if (!existing) {
    return { error: "That program is missing." };
  }

  await getDb()
    .update(program)
    .set({ name: cleaned.name, updatedAt: new Date() })
    .where(eq(program.id, programId));

  return { ok: true as const };
}

export async function createProgram(input: {
  userId: string;
  name: string;
  note: string;
  missionIds: number[];
  objectKey: string;
  fileName: string;
}) {
  const cleanedName = cleanName(input.name);
  if ("error" in cleanedName) {
    return cleanedName;
  }
  const cleanedNote = cleanNote(input.note);
  if ("error" in cleanedNote) {
    return cleanedNote;
  }
  const file = await assertUploadedFile(input.objectKey, input.fileName, input.userId);
  if ("error" in file) {
    return file;
  }

  const missionIds = await keepKnownMissions(input.missionIds);
  const programId = crypto.randomUUID();
  const versionId = crypto.randomUUID();

  await getDb().transaction(async (tx) => {
    await tx.insert(program).values({
      id: programId,
      name: cleanedName.name,
      createdById: input.userId,
    });
    await tx.insert(programVersion).values({
      id: versionId,
      programId,
      versionNumber: 1,
      blobUrl: file.key,
      blobPathname: file.key,
      fileName: file.fileName,
      note: cleanedNote.note,
      uploadedById: input.userId,
    });
    if (missionIds.length > 0) {
      await tx.insert(versionMission).values(
        missionIds.map((missionId) => ({ versionId, missionId })),
      );
    }
  });

  return { id: programId };
}

export async function addProgramVersion(input: {
  userId: string;
  programId: string;
  name: string;
  note: string;
  missionIds: number[];
  objectKey: string;
  fileName: string;
}) {
  const cleanedName = cleanName(input.name);
  if ("error" in cleanedName) {
    return cleanedName;
  }
  const cleanedNote = cleanNote(input.note);
  if ("error" in cleanedNote) {
    return cleanedNote;
  }
  const file = await assertUploadedFile(input.objectKey, input.fileName, input.userId);
  if ("error" in file) {
    return file;
  }

  const missionIds = await keepKnownMissions(input.missionIds);
  const versionId = crypto.randomUUID();

  await getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: program.id })
      .from(program)
      .where(eq(program.id, input.programId))
      .limit(1);
    if (!existing) {
      throw new Error("MISSING_PROGRAM");
    }

    await tx
      .update(program)
      .set({ name: cleanedName.name, updatedAt: new Date() })
      .where(eq(program.id, input.programId));

    const [latest] = await tx
      .select({ value: max(programVersion.versionNumber) })
      .from(programVersion)
      .where(eq(programVersion.programId, input.programId));
    const versionNumber = (latest?.value ?? 0) + 1;

    await tx.insert(programVersion).values({
      id: versionId,
      programId: input.programId,
      versionNumber,
      blobUrl: file.key,
      blobPathname: file.key,
      fileName: file.fileName,
      note: cleanedNote.note,
      uploadedById: input.userId,
    });
    if (missionIds.length > 0) {
      await tx.insert(versionMission).values(
        missionIds.map((missionId) => ({ versionId, missionId })),
      );
    }
  });

  return { id: input.programId };
}
