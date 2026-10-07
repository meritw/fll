import { and, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  teamProject,
  teamProjectCommit,
  teamProjectConflict,
  teamProjectUpload,
  user,
} from "@/db/schema";
import {
  getStorageObjectBytes,
  headStorageObject,
  isTeamProjectUploadKey,
  MAX_TEAM_PROJECT_BYTES,
  objectKeyForTeamProjectConflictBlob,
  objectKeyForTeamProjectRepo,
  putStorageObject,
  storageConfig,
} from "@/lib/storage";

import {
  createMemFs,
  initRepo,
  readWorkingTree,
  replaceWorkingTree,
  REPO_DIR,
  stageAllAndCommit,
  treeAtCommit,
  unzipIntoMemfs,
  unzipProjectFiles,
  zipMemfs,
  zipProjectFiles,
  type GitFs,
} from "./fs";
import { TEAM_PROJECT_ID } from "./constants";
import { mergeTrees } from "./merge";

export { PYBRICKS_CODE_URL, TEAM_PROJECT_ID } from "./constants";

const STARTER_MAIN_PY = `# Rolling Sparks team project
# 1. Download this zip from Rolling Sparks
# 2. In Pybricks Code: open or restore this backup
# 3. When finished: Backup → upload the zip back here

from pybricks.hubs import PrimeHub

hub = PrimeHub()
hub.display.text("Hi!")
`;

function authorFromUser(input: { name?: string | null; email?: string | null; id: string }) {
  return {
    name: input.name?.trim() || "Rolling Sparks",
    email: input.email?.trim() || `${input.id}@students.local`,
  };
}

async function ensureProjectRow() {
  const db = getDb();
  const existing = await db.query.teamProject.findFirst({
    where: eq(teamProject.id, TEAM_PROJECT_ID),
  });
  if (existing) {
    return existing;
  }
  const [created] = await db
    .insert(teamProject)
    .values({
      id: TEAM_PROJECT_ID,
      name: "Rolling Sparks Pybricks project",
      headSha: null,
      repoObjectKey: null,
    })
    .onConflictDoNothing()
    .returning();
  if (created) {
    return created;
  }
  const again = await db.query.teamProject.findFirst({
    where: eq(teamProject.id, TEAM_PROJECT_ID),
  });
  if (!again) {
    throw new Error("Could not create team project.");
  }
  return again;
}

async function loadRepo(): Promise<{
  fs: GitFs;
  vol: ReturnType<typeof createMemFs>["vol"];
  dir: string;
  project: typeof teamProject.$inferSelect;
}> {
  const project = await ensureProjectRow();
  const { vol, fs } = createMemFs();
  const dir = REPO_DIR;
  if (project.repoObjectKey) {
    const bytes = await getStorageObjectBytes(project.repoObjectKey);
    if (bytes) {
      await unzipIntoMemfs(bytes, vol, dir);
      return { fs, vol, dir, project };
    }
  }
  await initRepo(fs, dir);
  return { fs, vol, dir, project };
}

async function persistRepo(
  vol: ReturnType<typeof createMemFs>["vol"],
  projectId: string,
  headSha: string,
) {
  const zip = await zipMemfs(vol, REPO_DIR);
  const key = objectKeyForTeamProjectRepo(projectId);
  const put = await putStorageObject(key, zip);
  if (!put) {
    throw new Error("File saving is not set up yet. Ask a coach.");
  }
  const db = getDb();
  await db
    .update(teamProject)
    .set({ headSha, repoObjectKey: key, updatedAt: new Date() })
    .where(eq(teamProject.id, projectId));
  return key;
}

function starterFiles() {
  return new Map<string, Uint8Array>([
    ["main.py", new TextEncoder().encode(STARTER_MAIN_PY)],
  ]);
}

export async function getTeamProjectSummary() {
  const project = await ensureProjectRow();
  const db = getDb();
  const [commits, openConflicts, recentUploads] = await Promise.all([
    db
      .select({
        id: teamProjectCommit.id,
        sha: teamProjectCommit.sha,
        message: teamProjectCommit.message,
        createdAt: teamProjectCommit.createdAt,
        uploadedByName: user.name,
        uploadedByUsername: user.username,
      })
      .from(teamProjectCommit)
      .innerJoin(user, eq(teamProjectCommit.uploadedById, user.id))
      .where(eq(teamProjectCommit.projectId, TEAM_PROJECT_ID))
      .orderBy(desc(teamProjectCommit.createdAt))
      .limit(12),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(teamProjectConflict)
      .where(
        and(
          eq(teamProjectConflict.projectId, TEAM_PROJECT_ID),
          eq(teamProjectConflict.status, "open"),
        ),
      ),
    db
      .select({
        id: teamProjectUpload.id,
        status: teamProjectUpload.status,
        message: teamProjectUpload.message,
        fileName: teamProjectUpload.fileName,
        createdAt: teamProjectUpload.createdAt,
        uploadedByName: user.name,
      })
      .from(teamProjectUpload)
      .innerJoin(user, eq(teamProjectUpload.uploadedById, user.id))
      .where(eq(teamProjectUpload.projectId, TEAM_PROJECT_ID))
      .orderBy(desc(teamProjectUpload.createdAt))
      .limit(8),
  ]);

  return {
    project,
    commits,
    openConflictCount: openConflicts[0]?.count ?? 0,
    recentUploads,
    storageReady: Boolean(storageConfig()),
  };
}

export async function buildDownloadZip(): Promise<{
  bytes: Buffer;
  headSha: string | null;
  fileName: string;
}> {
  const { fs, vol, dir, project } = await loadRepo();
  let files: Map<string, Uint8Array>;
  if (project.headSha) {
    files = await readWorkingTree(fs, dir);
    if (files.size === 0) {
      files = await treeAtCommit(fs, dir, project.headSha);
    }
  } else {
    files = starterFiles();
  }
  if (files.size === 0) {
    files = starterFiles();
  }
  const bytes = await zipProjectFiles(files);
  void vol;
  return {
    bytes,
    headSha: project.headSha,
    fileName: "rolling-sparks-pybricks.zip",
  };
}

export async function assertTeamProjectUpload(
  objectKey: string,
  fileName: string,
  userId: string,
) {
  if (!fileName.toLowerCase().endsWith(".zip")) {
    return { error: "Choose a .zip file from Pybricks Backup." };
  }
  if (!isTeamProjectUploadKey(userId, objectKey)) {
    return { error: "That upload is not valid." };
  }
  const head = await headStorageObject(objectKey);
  if (!head || head.size <= 0 || head.size > MAX_TEAM_PROJECT_BYTES) {
    return { error: "That file is missing or too large." };
  }
  return { ok: true as const, size: head.size };
}

async function storeConflictSide(
  projectId: string,
  conflictId: string,
  side: "base" | "ours" | "theirs",
  data: Uint8Array | null,
  asText: boolean,
) {
  if (!data) {
    return { content: null as string | null, objectKey: null as string | null };
  }
  if (asText && data.byteLength <= 200_000) {
    return {
      content: new TextDecoder("utf-8").decode(data),
      objectKey: null as string | null,
    };
  }
  const key = objectKeyForTeamProjectConflictBlob(projectId, conflictId, side);
  await putStorageObject(key, data);
  return { content: null as string | null, objectKey: key };
}

export async function ingestTeamProjectUpload(input: {
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  objectKey: string;
  fileName: string;
  message?: string;
  baseSha?: string | null;
}) {
  const checked = await assertTeamProjectUpload(
    input.objectKey,
    input.fileName,
    input.userId,
  );
  if ("error" in checked) {
    return { error: checked.error };
  }

  const zipBytes = await getStorageObjectBytes(input.objectKey);
  if (!zipBytes) {
    return { error: "Could not read that upload. Try again." };
  }

  let theirs: Map<string, Uint8Array>;
  try {
    theirs = await unzipProjectFiles(zipBytes);
  } catch {
    return { error: "That zip could not be opened. Export a Pybricks backup zip." };
  }
  if (theirs.size === 0) {
    return { error: "That zip has no project files in it." };
  }

  const db = getDb();
  const uploadId = crypto.randomUUID();
  const message = (input.message ?? "").trim() || "Team project upload";
  const author = authorFromUser({
    id: input.userId,
    name: input.userName,
    email: input.userEmail,
  });

  const { fs, vol, dir, project } = await loadRepo();

  // First upload seeds the repo.
  if (!project.headSha) {
    await replaceWorkingTree(fs, theirs, dir);
    const sha = await stageAllAndCommit({
      fs,
      dir,
      message,
      name: author.name,
      email: author.email,
    });
    await persistRepo(vol, project.id, sha);
    await db.insert(teamProjectUpload).values({
      id: uploadId,
      projectId: project.id,
      uploadedById: input.userId,
      objectKey: input.objectKey,
      fileName: input.fileName,
      message,
      baseSha: null,
      status: "seeded",
      resultCommitSha: sha,
    });
    await db.insert(teamProjectCommit).values({
      id: crypto.randomUUID(),
      projectId: project.id,
      sha,
      parentSha: null,
      baseSha: null,
      message,
      uploadedById: input.userId,
      uploadObjectKey: input.objectKey,
    });
    return { status: "seeded" as const, sha, uploadId };
  }

  const ours = await treeAtCommit(fs, dir, project.headSha);
  let baseSha = input.baseSha?.trim() || null;
  let base: Map<string, Uint8Array>;
  if (baseSha) {
    try {
      base = await treeAtCommit(fs, dir, baseSha);
    } catch {
      baseSha = project.headSha;
      base = new Map(ours);
    }
  } else {
    // No download marker → treat HEAD as base (2-way / last overlapping wins via conflict).
    baseSha = project.headSha;
    base = new Map(ours);
  }

  const { result, conflicts } = mergeTrees(base, ours, theirs);

  if (conflicts.length > 0) {
    await db.insert(teamProjectUpload).values({
      id: uploadId,
      projectId: project.id,
      uploadedById: input.userId,
      objectKey: input.objectKey,
      fileName: input.fileName,
      message,
      baseSha,
      status: "conflict",
      resultCommitSha: null,
    });

    for (const conflict of conflicts) {
      const conflictId = crypto.randomUUID();
      const asText = conflict.kind === "text";
      const [baseSide, oursSide, theirsSide] = await Promise.all([
        storeConflictSide(project.id, conflictId, "base", conflict.base, asText),
        storeConflictSide(project.id, conflictId, "ours", conflict.ours, asText),
        storeConflictSide(project.id, conflictId, "theirs", conflict.theirs, asText),
      ]);
      await db.insert(teamProjectConflict).values({
        id: conflictId,
        projectId: project.id,
        uploadId,
        path: conflict.path,
        kind: conflict.kind,
        status: "open",
        baseContent: baseSide.content,
        oursContent: oursSide.content,
        theirsContent: theirsSide.content,
        baseObjectKey: baseSide.objectKey,
        oursObjectKey: oursSide.objectKey,
        theirsObjectKey: theirsSide.objectKey,
        uploadedById: input.userId,
      });
    }

    return {
      status: "conflict" as const,
      uploadId,
      conflictCount: conflicts.length,
    };
  }

  await replaceWorkingTree(fs, result, dir);
  const sha = await stageAllAndCommit({
    fs,
    dir,
    message,
    name: author.name,
    email: author.email,
  });
  await persistRepo(vol, project.id, sha);
  await db.insert(teamProjectUpload).values({
    id: uploadId,
    projectId: project.id,
    uploadedById: input.userId,
    objectKey: input.objectKey,
    fileName: input.fileName,
    message,
    baseSha,
    status: "merged",
    resultCommitSha: sha,
  });
  await db.insert(teamProjectCommit).values({
    id: crypto.randomUUID(),
    projectId: project.id,
    sha,
    parentSha: project.headSha,
    baseSha,
    message,
    uploadedById: input.userId,
    uploadObjectKey: input.objectKey,
  });

  return { status: "merged" as const, sha, uploadId };
}

export async function listOpenConflicts() {
  const db = getDb();
  return db
    .select({
      id: teamProjectConflict.id,
      path: teamProjectConflict.path,
      kind: teamProjectConflict.kind,
      createdAt: teamProjectConflict.createdAt,
      uploadId: teamProjectConflict.uploadId,
      uploadMessage: teamProjectUpload.message,
      uploadedByName: user.name,
      uploadedByUsername: user.username,
    })
    .from(teamProjectConflict)
    .innerJoin(user, eq(teamProjectConflict.uploadedById, user.id))
    .innerJoin(teamProjectUpload, eq(teamProjectConflict.uploadId, teamProjectUpload.id))
    .where(
      and(
        eq(teamProjectConflict.projectId, TEAM_PROJECT_ID),
        eq(teamProjectConflict.status, "open"),
      ),
    )
    .orderBy(desc(teamProjectConflict.createdAt));
}

export async function getConflict(conflictId: string) {
  const db = getDb();
  const row = await db.query.teamProjectConflict.findFirst({
    where: and(
      eq(teamProjectConflict.id, conflictId),
      eq(teamProjectConflict.projectId, TEAM_PROJECT_ID),
    ),
    with: {
      uploadedBy: true,
      upload: true,
    },
  });
  return row ?? null;
}

async function loadSideBytes(input: {
  content: string | null;
  objectKey: string | null;
}): Promise<Uint8Array | null> {
  if (input.content !== null && input.content !== undefined) {
    return new TextEncoder().encode(input.content);
  }
  if (input.objectKey) {
    const bytes = await getStorageObjectBytes(input.objectKey);
    return bytes ? new Uint8Array(bytes) : null;
  }
  return null;
}

export async function resolveConflict(input: {
  conflictId: string;
  coachUserId: string;
  coachName?: string | null;
  coachEmail?: string | null;
  choice: "ours" | "theirs" | "custom";
  customText?: string;
}) {
  const db = getDb();
  const conflict = await getConflict(input.conflictId);
  if (!conflict) {
    return { error: "That conflict was not found." };
  }
  if (conflict.status !== "open") {
    return { error: "That conflict is already resolved." };
  }

  let resolved: Uint8Array | null;
  if (input.choice === "ours") {
    resolved = await loadSideBytes({
      content: conflict.oursContent,
      objectKey: conflict.oursObjectKey,
    });
  } else if (input.choice === "theirs") {
    resolved = await loadSideBytes({
      content: conflict.theirsContent,
      objectKey: conflict.theirsObjectKey,
    });
  } else {
    if (conflict.kind !== "text") {
      return { error: "Custom text only works for text conflicts. Pick team or upload, or upload a fixed zip." };
    }
    resolved = new TextEncoder().encode(input.customText ?? "");
  }

  // Apply into a pending resolution store; when all conflicts for the upload
  // are resolved, commit the merged tree.
  const asText = conflict.kind === "text" && resolved !== null && resolved.byteLength <= 200_000;
  let resolvedContent: string | null = null;
  let resolvedObjectKey: string | null = null;
  if (resolved) {
    if (asText) {
      resolvedContent = new TextDecoder("utf-8").decode(resolved);
    } else {
      resolvedObjectKey = objectKeyForTeamProjectConflictBlob(
        conflict.projectId,
        conflict.id,
        "resolved",
      );
      await putStorageObject(resolvedObjectKey, resolved);
    }
  }

  await db
    .update(teamProjectConflict)
    .set({
      status: "resolved",
      resolution: input.choice,
      resolvedContent,
      resolvedObjectKey,
      resolvedById: input.coachUserId,
      resolvedAt: new Date(),
    })
    .where(eq(teamProjectConflict.id, conflict.id));

  const remaining = await db
    .select({ id: teamProjectConflict.id })
    .from(teamProjectConflict)
    .where(
      and(
        eq(teamProjectConflict.uploadId, conflict.uploadId),
        eq(teamProjectConflict.status, "open"),
      ),
    );

  if (remaining.length > 0) {
    return { status: "partial" as const, remaining: remaining.length };
  }

  // All conflicts for this upload resolved → build merged tree and commit.
  const commitResult = await finalizeResolvedUpload({
    uploadId: conflict.uploadId,
    coachUserId: input.coachUserId,
    coachName: input.coachName,
    coachEmail: input.coachEmail,
  });
  if ("error" in commitResult) {
    return { error: commitResult.error };
  }
  return { status: "committed" as const, sha: commitResult.sha };
}

async function finalizeResolvedUpload(input: {
  uploadId: string;
  coachUserId: string;
  coachName?: string | null;
  coachEmail?: string | null;
}) {
  const db = getDb();
  const upload = await db.query.teamProjectUpload.findFirst({
    where: eq(teamProjectUpload.id, input.uploadId),
  });
  if (!upload) {
    return { error: "Upload not found." };
  }
  if (upload.status === "merged" || upload.status === "seeded") {
    if (!upload.resultCommitSha) {
      return { error: "Upload is missing a commit sha." };
    }
    return { sha: upload.resultCommitSha };
  }

  const conflicts = await db.query.teamProjectConflict.findMany({
    where: eq(teamProjectConflict.uploadId, input.uploadId),
  });
  if (conflicts.some((c) => c.status !== "resolved")) {
    return { error: "Still has open conflicts." };
  }

  const zipBytes = await getStorageObjectBytes(upload.objectKey);
  if (!zipBytes) {
    return { error: "Original upload zip is missing." };
  }
  const theirs = await unzipProjectFiles(zipBytes);
  const { fs, vol, dir, project } = await loadRepo();
  if (!project.headSha) {
    return { error: "Team project has no HEAD." };
  }

  const ours = await treeAtCommit(fs, dir, project.headSha);
  let base: Map<string, Uint8Array>;
  if (upload.baseSha) {
    try {
      base = await treeAtCommit(fs, dir, upload.baseSha);
    } catch {
      base = new Map(ours);
    }
  } else {
    base = new Map(ours);
  }

  // Re-merge auto paths, then overlay coach resolutions for conflict paths.
  const { result } = mergeTrees(base, ours, theirs);
  for (const conflict of conflicts) {
    const bytes = await loadSideBytes({
      content: conflict.resolvedContent,
      objectKey: conflict.resolvedObjectKey,
    });
    if (bytes) {
      result.set(conflict.path, bytes);
    } else {
      result.delete(conflict.path);
    }
  }

  const author = authorFromUser({
    id: input.coachUserId,
    name: input.coachName,
    email: input.coachEmail,
  });
  const message = `Resolve conflicts from: ${upload.message || upload.fileName}`;
  await replaceWorkingTree(fs, result, dir);
  const sha = await stageAllAndCommit({
    fs,
    dir,
    message,
    name: author.name,
    email: author.email,
  });
  await persistRepo(vol, project.id, sha);

  await db
    .update(teamProjectUpload)
    .set({ status: "merged", resultCommitSha: sha })
    .where(eq(teamProjectUpload.id, upload.id));
  await db.insert(teamProjectCommit).values({
    id: crypto.randomUUID(),
    projectId: project.id,
    sha,
    parentSha: project.headSha,
    baseSha: upload.baseSha,
    message,
    uploadedById: input.coachUserId,
    uploadObjectKey: upload.objectKey,
  });

  return { sha };
}

/** Coach uploads a fully fixed zip that becomes the new HEAD (no merge). */
export async function coachForceUpload(input: {
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  objectKey: string;
  fileName: string;
  message?: string;
}) {
  const checked = await assertTeamProjectUpload(
    input.objectKey,
    input.fileName,
    input.userId,
  );
  if ("error" in checked) {
    return { error: checked.error };
  }
  const zipBytes = await getStorageObjectBytes(input.objectKey);
  if (!zipBytes) {
    return { error: "Could not read that upload." };
  }
  let files: Map<string, Uint8Array>;
  try {
    files = await unzipProjectFiles(zipBytes);
  } catch {
    return { error: "That zip could not be opened." };
  }
  if (files.size === 0) {
    return { error: "That zip has no project files in it." };
  }

  const { fs, vol, dir, project } = await loadRepo();
  const author = authorFromUser({
    id: input.userId,
    name: input.userName,
    email: input.userEmail,
  });
  const message = (input.message ?? "").trim() || "Coach fixed project zip";
  await replaceWorkingTree(fs, files, dir);
  const sha = await stageAllAndCommit({
    fs,
    dir,
    message,
    name: author.name,
    email: author.email,
  });
  await persistRepo(vol, project.id, sha);

  const db = getDb();
  const uploadId = crypto.randomUUID();
  await db.insert(teamProjectUpload).values({
    id: uploadId,
    projectId: project.id,
    uploadedById: input.userId,
    objectKey: input.objectKey,
    fileName: input.fileName,
    message,
    baseSha: project.headSha,
    status: "merged",
    resultCommitSha: sha,
  });
  await db.insert(teamProjectCommit).values({
    id: crypto.randomUUID(),
    projectId: project.id,
    sha,
    parentSha: project.headSha,
    baseSha: project.headSha,
    message,
    uploadedById: input.userId,
    uploadObjectKey: input.objectKey,
  });

  // Close any leftover open conflicts — coach zip is canonical now.
  await db
    .update(teamProjectConflict)
    .set({
      status: "resolved",
      resolution: "custom",
      resolvedById: input.userId,
      resolvedAt: new Date(),
    })
    .where(
      and(
        eq(teamProjectConflict.projectId, project.id),
        eq(teamProjectConflict.status, "open"),
      ),
    );

  return { status: "merged" as const, sha, uploadId };
}
