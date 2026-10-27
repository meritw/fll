import { isProbablyText, mergeTrees, type FileBytes } from "./merge";
import {
  listCommitOids,
  readBlobAt,
  replaceWorkingTree,
  REPO_DIR,
  stageAllAndCommit,
  type GitFs,
} from "./fs";

/** First line Pybricks writes for a block program, including version and scroll position. */
const BLOCKS_PREFIX = "# pybricks blocks file:";

export type StaleChoice = "replace" | "unsure";

export type PlannedConflict = {
  path: string;
  kind: "text" | "binary";
  base: FileBytes;
  ours: FileBytes;
  theirs: FileBytes;
};

export type UploadPlan = {
  /** Tip files with every uploaded path overwritten by the exact uploaded bytes. */
  snapshot: Map<string, Uint8Array>;
  /** Tree that should become HEAD. */
  tip: Map<string, Uint8Array>;
  conflicts: PlannedConflict[];
  stalePaths: string[];
};

/**
 * Identity of a program, ignoring Pybricks chrome.
 *
 * Block files store `info.version` (2.0.0 vs 2.1.1) and `workspaceOptions`
 * (scroll and zoom) on the first line. Those change when a kid opens the file
 * in a newer Pybricks. The blocks and the Python under that line do not.
 */
export function programBody(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return Buffer.from(bytes).toString("hex");
  }
  if (!text.startsWith(BLOCKS_PREFIX)) {
    return text;
  }
  const newline = text.indexOf("\n");
  const headerLine = newline === -1 ? text : text.slice(0, newline);
  const rest = newline === -1 ? "" : text.slice(newline + 1);
  return `${canonicalBlocksHeader(headerLine.slice(BLOCKS_PREFIX.length))}\n${rest}`;
}

function canonicalBlocksHeader(jsonText: string) {
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return jsonText;
    }
    const next = { ...(parsed as Record<string, unknown>) };
    delete next.workspaceOptions;
    if (next.info && typeof next.info === "object" && !Array.isArray(next.info)) {
      const info = { ...(next.info as Record<string, unknown>) };
      delete info.version;
      next.info = info;
    }
    return JSON.stringify(next);
  } catch {
    return jsonText;
  }
}

export function bytesEqual(a: Uint8Array | null | undefined, b: Uint8Array | null | undefined) {
  if (a === b) {
    return true;
  }
  if (!a || !b || a.byteLength !== b.byteLength) {
    return false;
  }
  for (let i = 0; i < a.byteLength; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export function treesEqual(a: Map<string, Uint8Array>, b: Map<string, Uint8Array>) {
  if (a.size !== b.size) {
    return false;
  }
  for (const [path, bytes] of a) {
    if (!bytesEqual(bytes, b.get(path))) {
      return false;
    }
  }
  return true;
}

function overlay(base: Map<string, Uint8Array>, over: Map<string, Uint8Array>) {
  const next = new Map(base);
  for (const [path, bytes] of over) {
    next.set(path, bytes);
  }
  return next;
}

/**
 * Paths whose upload is an older saved copy of that same file.
 * A new file, a new edit, or a header-only Pybricks rewrite of the tip is not stale.
 */
export function findStaleCopies(input: {
  ours: Map<string, Uint8Array>;
  theirs: Map<string, Uint8Array>;
  olderBodies: Map<string, Set<string>>;
}) {
  const stale: string[] = [];
  for (const path of [...input.theirs.keys()].sort()) {
    const tip = input.ours.get(path);
    const uploaded = input.theirs.get(path);
    if (!tip || !uploaded) {
      continue;
    }
    const uploadedBody = programBody(uploaded);
    if (uploadedBody === programBody(tip)) {
      continue;
    }
    if (input.olderBodies.get(path)?.has(uploadedBody)) {
      stale.push(path);
    }
  }
  return stale;
}

/** Bodies of `paths` on ancestor commits, excluding whatever is on the tip now. */
export async function collectOlderBodies(
  fs: GitFs,
  dir: string,
  headSha: string,
  ours: Map<string, Uint8Array>,
  paths: string[],
) {
  const older = new Map<string, Set<string>>();
  const tipBody = new Map<string, string>();
  for (const path of paths) {
    const tip = ours.get(path);
    if (!tip) {
      continue;
    }
    tipBody.set(path, programBody(tip));
    older.set(path, new Set());
  }
  if (tipBody.size === 0) {
    return older;
  }
  const oids = await listCommitOids(fs, dir, headSha);
  for (const oid of oids) {
    for (const [path, current] of tipBody) {
      const blob = await readBlobAt(fs, dir, oid, path);
      if (!blob) {
        continue;
      }
      const body = programBody(blob);
      if (body !== current) {
        older.get(path)!.add(body);
      }
    }
  }
  return older;
}

export function planUpload(input: {
  base: Map<string, Uint8Array>;
  ours: Map<string, Uint8Array>;
  theirs: Map<string, Uint8Array>;
  olderBodies: Map<string, Set<string>>;
  staleChoice: StaleChoice | null;
}): { needsChoice: true; paths: string[] } | { needsChoice: false; plan: UploadPlan } {
  const stalePaths = findStaleCopies(input);
  if (stalePaths.length > 0 && !input.staleChoice) {
    return { needsChoice: true, paths: stalePaths };
  }

  const { result, conflicts } = mergeTrees(input.base, input.ours, input.theirs);
  // Start from the tip so a conflict (omitted from the merge result) cannot delete a file.
  const tip = overlay(input.ours, result);
  const conflictByPath = new Map(conflicts.map((conflict) => [conflict.path, conflict]));

  if (input.staleChoice === "replace") {
    for (const path of stalePaths) {
      tip.set(path, input.theirs.get(path)!);
      conflictByPath.delete(path);
    }
  } else if (input.staleChoice === "unsure") {
    for (const path of stalePaths) {
      const oursBytes = input.ours.get(path) ?? null;
      if (oursBytes) {
        tip.set(path, oursBytes);
      }
      if (!conflictByPath.has(path)) {
        const uploaded = input.theirs.get(path)!;
        conflictByPath.set(path, {
          path,
          kind: conflictKind(path, input.base.get(path) ?? null, oursBytes, uploaded),
          base: input.base.get(path) ?? null,
          ours: oursBytes,
          theirs: uploaded,
        });
      }
    }
  }

  return {
    needsChoice: false,
    plan: {
      snapshot: overlay(input.ours, input.theirs),
      tip,
      conflicts: [...conflictByPath.values()].sort((a, b) => a.path.localeCompare(b.path)),
      stalePaths,
    },
  };
}

function conflictKind(path: string, base: FileBytes, ours: FileBytes, theirs: FileBytes) {
  if (isProbablyText(path, base) && isProbablyText(path, ours) && isProbablyText(path, theirs)) {
    return "text" as const;
  }
  return "binary" as const;
}

export function snapshotCommitMessage(note: string) {
  return `Saved the uploaded files: ${note}`;
}

export type PlannedCommit = {
  sha: string;
  parentSha: string | null;
  message: string;
};

/**
 * Commit the exact uploaded bytes, then the tip tree when they differ.
 * The snapshot stays reachable from HEAD so a later "keep the team file"
 * choice cannot throw the upload away.
 */
export async function commitPlannedTrees(input: {
  fs: GitFs;
  dir?: string;
  parentSha: string | null;
  headTree: Map<string, Uint8Array>;
  snapshot: Map<string, Uint8Array>;
  tip: Map<string, Uint8Array>;
  snapshotMessage: string;
  tipMessage: string;
  name: string;
  email: string;
}): Promise<{ commits: PlannedCommit[]; headSha: string }> {
  const dir = input.dir ?? REPO_DIR;
  const queue: Array<{ files: Map<string, Uint8Array>; message: string }> = [];
  if (!treesEqual(input.snapshot, input.tip) && !treesEqual(input.snapshot, input.headTree)) {
    queue.push({ files: input.snapshot, message: input.snapshotMessage });
  }
  const tipBase = queue.length > 0 ? input.snapshot : input.headTree;
  if (!treesEqual(input.tip, tipBase) || queue.length === 0) {
    queue.push({ files: input.tip, message: input.tipMessage });
  }

  const commits: PlannedCommit[] = [];
  let parentSha = input.parentSha;
  for (const step of queue) {
    await replaceWorkingTree(input.fs, step.files, dir);
    const sha = await stageAllAndCommit({
      fs: input.fs,
      dir,
      message: step.message,
      name: input.name,
      email: input.email,
    });
    commits.push({ sha, parentSha, message: step.message });
    parentSha = sha;
  }
  return { commits, headSha: parentSha ?? input.parentSha ?? "" };
}
