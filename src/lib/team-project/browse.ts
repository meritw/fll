import { cache } from "react";
import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { teamProjectCommit, user } from "@/db/schema";

import { TEAM_PROJECT_ID } from "./constants";
import { treeAtCommit, type GitFs } from "./fs";
import { loadRepo, readDownloadTree } from "./index";

export type BrowseRev = "now" | { sha: string };

export type BrowseFile = {
  path: string;
  kind: "python" | "text" | "binary";
  bytes: Uint8Array;
};

export type BrowseCommit = {
  sha: string;
  parentSha: string | null;
  message: string;
  createdAt: Date;
  uploaderName: string;
};

export type BrowseSnapshot = {
  rev: BrowseRev;
  headSha: string | null;
  starter: boolean;
  files: Map<string, BrowseFile>;
};

export type BrowseChangeKind = "added" | "changed" | "removed";

export type BrowseDiffRow =
  | { kind: "same"; oldNo: number; newNo: number }
  | { kind: "add"; newNo: number }
  | { kind: "del"; oldNo: number };

export type BrowseFileDiff = {
  path: string;
  parentSha: string | null;
  change: BrowseChangeKind | "same" | "binary" | "too_big" | "missing";
  beforeText: string | null;
  afterText: string | null;
  rows: BrowseDiffRow[];
};

export const MAX_BROWSE_TEXT_BYTES = 512_000;

const FULL_SHA = /^[0-9a-f]{40}$/;
const DIFF_LINE_CAP = 2000;

const openRepo = cache(loadRepo);

export function revKey(rev: BrowseRev): string {
  return rev === "now" ? "now" : rev.sha;
}

export function isSafeBrowsePath(path: string): boolean {
  if (!path || path.startsWith("/") || path.includes("\\") || path.includes("\0")) {
    return false;
  }
  if (path === ".git" || path.startsWith(".git/")) {
    return false;
  }
  const parts = path.split("/");
  return parts.every((part) => part !== "" && part !== "." && part !== "..");
}

export function classifyBrowseBytes(path: string, bytes: Uint8Array): BrowseFile["kind"] {
  const sample = bytes.subarray(0, Math.min(bytes.byteLength, 8000));
  for (let i = 0; i < sample.byteLength; i += 1) {
    if (sample[i] === 0) {
      return "binary";
    }
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sample);
  } catch {
    return "binary";
  }
  const dot = path.lastIndexOf(".");
  const ext = dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
  return ext === "py" ? "python" : "text";
}

function pathRank(path: string): number {
  if (path.toLowerCase() === "main.py") {
    return 0;
  }
  if (path.toLowerCase().endsWith(".py")) {
    return 1;
  }
  return 2;
}

export function sortBrowsePaths(paths: readonly string[]): string[] {
  return [...paths].sort((a, b) => {
    const byRank = pathRank(a) - pathRank(b);
    if (byRank !== 0) {
      return byRank;
    }
    return a.localeCompare(b);
  });
}

export function toBrowseSnapshot(input: {
  rev: BrowseRev;
  headSha: string | null;
  starter: boolean;
  files: Map<string, Uint8Array>;
}): BrowseSnapshot {
  const files = new Map<string, BrowseFile>();
  for (const path of sortBrowsePaths([...input.files.keys()])) {
    if (!isSafeBrowsePath(path)) {
      continue;
    }
    const bytes = input.files.get(path);
    if (!bytes) {
      continue;
    }
    files.set(path, { path, kind: classifyBrowseBytes(path, bytes), bytes });
  }
  return {
    rev: input.rev,
    headSha: input.headSha,
    starter: input.starter,
    files,
  };
}

export function pickBrowsePath(files: Map<string, BrowseFile>): string | null {
  if (files.has("main.py")) {
    return "main.py";
  }
  for (const path of files.keys()) {
    if (files.get(path)?.kind === "python") {
      return path;
    }
  }
  for (const path of files.keys()) {
    if (files.get(path)?.kind === "text") {
      return path;
    }
  }
  const first = files.keys().next();
  return first.done ? null : first.value;
}

export function splitBrowseLines(text: string): string[] {
  if (text.length === 0) {
    return [];
  }
  const lines = text.split("\n");
  if (text.endsWith("\n")) {
    lines.pop();
  }
  return lines;
}

export function diffBrowseRows(before: string, after: string): BrowseDiffRow[] {
  const oldLines = splitBrowseLines(before);
  const newLines = splitBrowseLines(after);
  if (oldLines.length > DIFF_LINE_CAP || newLines.length > DIFF_LINE_CAP) {
    const rows: BrowseDiffRow[] = [];
    for (let i = 0; i < oldLines.length; i += 1) {
      rows.push({ kind: "del", oldNo: i + 1 });
    }
    for (let i = 0; i < newLines.length; i += 1) {
      rows.push({ kind: "add", newNo: i + 1 });
    }
    return rows;
  }
  return alignLines(oldLines, newLines);
}

function alignLines(oldLines: string[], newLines: string[]): BrowseDiffRow[] {
  const n = oldLines.length;
  const m = newLines.length;
  const score: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      score[i][j] =
        oldLines[i] === newLines[j]
          ? score[i + 1][j + 1] + 1
          : Math.max(score[i + 1][j], score[i][j + 1]);
    }
  }
  const rows: BrowseDiffRow[] = [];
  let i = 0;
  let j = 0;
  let oldNo = 1;
  let newNo = 1;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      rows.push({ kind: "same", oldNo, newNo });
      i += 1;
      j += 1;
      oldNo += 1;
      newNo += 1;
    } else if (score[i + 1][j] >= score[i][j + 1]) {
      rows.push({ kind: "del", oldNo });
      i += 1;
      oldNo += 1;
    } else {
      rows.push({ kind: "add", newNo });
      j += 1;
      newNo += 1;
    }
  }
  while (i < n) {
    rows.push({ kind: "del", oldNo });
    i += 1;
    oldNo += 1;
  }
  while (j < m) {
    rows.push({ kind: "add", newNo });
    j += 1;
    newNo += 1;
  }
  return rows;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  for (let i = 0; i < a.byteLength; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export function listChangedPaths(
  before: Map<string, Uint8Array>,
  after: Map<string, Uint8Array>,
): Array<{ path: string; kind: BrowseChangeKind }> {
  const paths = sortBrowsePaths([...new Set([...before.keys(), ...after.keys()])]);
  const changes: Array<{ path: string; kind: BrowseChangeKind }> = [];
  for (const path of paths) {
    if (!isSafeBrowsePath(path)) {
      continue;
    }
    const prev = before.get(path);
    const next = after.get(path);
    if (!prev && next) {
      changes.push({ path, kind: "added" });
    } else if (prev && !next) {
      changes.push({ path, kind: "removed" });
    } else if (prev && next && !bytesEqual(prev, next)) {
      changes.push({ path, kind: "changed" });
    }
  }
  return changes;
}

export function pageBrowseCommits(
  commits: readonly BrowseCommit[],
  input?: { limit?: number; before?: string | null },
): { commits: BrowseCommit[]; nextBefore: string | null } {
  let start = 0;
  if (input?.before) {
    const index = commits.findIndex((commit) => commit.sha === input.before);
    start = index === -1 ? 0 : index + 1;
  }
  if (input?.limit == null) {
    return { commits: commits.slice(start), nextBefore: null };
  }
  const page = commits.slice(start, start + input.limit);
  const last = page[page.length - 1];
  const hasMore = start + input.limit < commits.length;
  return { commits: page, nextBefore: hasMore && last ? last.sha : null };
}

function oneParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function parseBrowseQuery(raw: {
  file?: string | string[];
  sha?: string | string[];
  view?: string | string[];
  before?: string | string[];
}): {
  file: string | null;
  rev: BrowseRev;
  shaRejected: boolean;
  fileRejected: boolean;
  changes: boolean;
  before: string | null;
} {
  const sha = (oneParam(raw.sha) ?? "").trim().toLowerCase();
  let rev: BrowseRev = "now";
  let shaRejected = false;
  if (sha && sha !== "now") {
    if (FULL_SHA.test(sha)) {
      rev = { sha };
    } else {
      shaRejected = true;
    }
  }
  const file = (oneParam(raw.file) ?? "").trim();
  const fileOk = file.length > 0 && isSafeBrowsePath(file);
  const before = (oneParam(raw.before) ?? "").trim().toLowerCase();
  return {
    file: fileOk ? file : null,
    rev,
    shaRejected,
    fileRejected: file.length > 0 && !fileOk,
    changes: oneParam(raw.view) === "changes" && rev !== "now",
    before: FULL_SHA.test(before) ? before : null,
  };
}

export async function filesAtRev(input: {
  fs: GitFs;
  dir: string;
  rev: BrowseRev;
  nowFiles: Map<string, Uint8Array>;
}): Promise<Map<string, Uint8Array> | null> {
  if (input.rev === "now") {
    return input.nowFiles;
  }
  try {
    return await treeAtCommit(input.fs, input.dir, input.rev.sha);
  } catch {
    return null;
  }
}

function decodeText(path: string, bytes: Uint8Array): string | null {
  if (classifyBrowseBytes(path, bytes) === "binary") {
    return null;
  }
  if (bytes.byteLength > MAX_BROWSE_TEXT_BYTES) {
    return null;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

async function commitRow(sha: string): Promise<BrowseCommit | null> {
  if (!FULL_SHA.test(sha)) {
    return null;
  }
  const db = getDb();
  const [row] = await db
    .select({
      sha: teamProjectCommit.sha,
      parentSha: teamProjectCommit.parentSha,
      message: teamProjectCommit.message,
      createdAt: teamProjectCommit.createdAt,
      uploaderName: user.name,
    })
    .from(teamProjectCommit)
    .innerJoin(user, eq(teamProjectCommit.uploadedById, user.id))
    .where(and(eq(teamProjectCommit.projectId, TEAM_PROJECT_ID), eq(teamProjectCommit.sha, sha)))
    .limit(1);
  return row ?? null;
}

export async function getSnapshot(rev: BrowseRev): Promise<
  | { ok: true; snapshot: BrowseSnapshot }
  | { ok: false; reason: "unknown_rev" | "unavailable" }
> {
  try {
    if (rev !== "now") {
      const row = await commitRow(rev.sha);
      if (!row) {
        return { ok: false, reason: "unknown_rev" };
      }
    }
    const loaded = await openRepo();
    const now = await readDownloadTree({
      fs: loaded.fs,
      dir: loaded.dir,
      headSha: loaded.project.headSha,
    });
    const files = await filesAtRev({
      fs: loaded.fs,
      dir: loaded.dir,
      rev,
      nowFiles: now.files,
    });
    if (!files) {
      return { ok: false, reason: "unknown_rev" };
    }
    return {
      ok: true,
      snapshot: toBrowseSnapshot({
        rev,
        headSha: loaded.project.headSha,
        starter: rev === "now" && now.starter,
        files,
      }),
    };
  } catch (error) {
    console.error("Could not open team code.", error);
    return { ok: false, reason: "unavailable" };
  }
}

export async function readFileAt(
  rev: BrowseRev,
  path: string,
): Promise<
  | { ok: true; file: BrowseFile }
  | { ok: false; reason: "bad_path" | "missing" | "too_big" | "unknown_rev" | "unavailable"; size?: number }
> {
  if (!isSafeBrowsePath(path)) {
    return { ok: false, reason: "bad_path" };
  }
  const snap = await getSnapshot(rev);
  if (!snap.ok) {
    return { ok: false, reason: snap.reason };
  }
  const file = snap.snapshot.files.get(path);
  if (!file) {
    return { ok: false, reason: "missing" };
  }
  if (file.kind !== "binary" && file.bytes.byteLength > MAX_BROWSE_TEXT_BYTES) {
    return { ok: false, reason: "too_big", size: file.bytes.byteLength };
  }
  return { ok: true, file };
}

export async function listCommits(input?: {
  limit?: number;
  before?: string | null;
}): Promise<{ commits: BrowseCommit[]; nextBefore: string | null }> {
  const db = getDb();
  const rows = await db
    .select({
      sha: teamProjectCommit.sha,
      parentSha: teamProjectCommit.parentSha,
      message: teamProjectCommit.message,
      createdAt: teamProjectCommit.createdAt,
      uploaderName: user.name,
    })
    .from(teamProjectCommit)
    .innerJoin(user, eq(teamProjectCommit.uploadedById, user.id))
    .where(eq(teamProjectCommit.projectId, TEAM_PROJECT_ID))
    .orderBy(desc(teamProjectCommit.createdAt), desc(teamProjectCommit.sha));
  return pageBrowseCommits(rows, input);
}

async function treesForCommit(sha: string): Promise<
  | {
      ok: true;
      parentSha: string | null;
      before: Map<string, Uint8Array>;
      after: Map<string, Uint8Array>;
    }
  | { ok: false; reason: "unknown_rev" | "unavailable" }
> {
  const row = await commitRow(sha);
  if (!row) {
    return { ok: false, reason: "unknown_rev" };
  }
  try {
    const loaded = await openRepo();
    const after = await treeAtCommit(loaded.fs, loaded.dir, sha);
    const before = row.parentSha
      ? await treeAtCommit(loaded.fs, loaded.dir, row.parentSha)
      : new Map<string, Uint8Array>();
    return { ok: true, parentSha: row.parentSha, before, after };
  } catch (error) {
    console.error("Could not read a team code version.", error);
    return { ok: false, reason: "unavailable" };
  }
}

export async function listChangedFiles(sha: string): Promise<
  | { ok: true; parentSha: string | null; files: Array<{ path: string; kind: BrowseChangeKind }> }
  | { ok: false; reason: "unknown_rev" | "unavailable" }
> {
  const trees = await treesForCommit(sha);
  if (!trees.ok) {
    return trees;
  }
  return {
    ok: true,
    parentSha: trees.parentSha,
    files: listChangedPaths(trees.before, trees.after),
  };
}

export async function diffFileAtCommit(
  sha: string,
  path: string,
): Promise<{ ok: true; diff: BrowseFileDiff } | { ok: false; reason: "unknown_rev" | "bad_path" | "unavailable" }> {
  if (!isSafeBrowsePath(path)) {
    return { ok: false, reason: "bad_path" };
  }
  const trees = await treesForCommit(sha);
  if (!trees.ok) {
    return trees;
  }
  const beforeBytes = trees.before.get(path);
  const afterBytes = trees.after.get(path);
  const base = {
    path,
    parentSha: trees.parentSha,
    beforeText: null,
    afterText: null,
    rows: [] as BrowseDiffRow[],
  };
  if (!beforeBytes && !afterBytes) {
    return { ok: true, diff: { ...base, change: "missing" } };
  }
  const beforeBinary = beforeBytes ? classifyBrowseBytes(path, beforeBytes) === "binary" : false;
  const afterBinary = afterBytes ? classifyBrowseBytes(path, afterBytes) === "binary" : false;
  if (beforeBinary || afterBinary) {
    return { ok: true, diff: { ...base, change: "binary" } };
  }
  const beforeTooBig = beforeBytes ? beforeBytes.byteLength > MAX_BROWSE_TEXT_BYTES : false;
  const afterTooBig = afterBytes ? afterBytes.byteLength > MAX_BROWSE_TEXT_BYTES : false;
  if (beforeTooBig || afterTooBig) {
    return { ok: true, diff: { ...base, change: "too_big" } };
  }
  const beforeText = beforeBytes ? decodeText(path, beforeBytes) : null;
  const afterText = afterBytes ? decodeText(path, afterBytes) : null;
  if ((beforeBytes && beforeText == null) || (afterBytes && afterText == null)) {
    return { ok: true, diff: { ...base, change: "binary" } };
  }
  if (!beforeBytes) {
    return {
      ok: true,
      diff: {
        ...base,
        change: "added",
        afterText,
        rows: diffBrowseRows("", afterText ?? ""),
      },
    };
  }
  if (!afterBytes) {
    return {
      ok: true,
      diff: {
        ...base,
        change: "removed",
        beforeText,
        rows: diffBrowseRows(beforeText ?? "", ""),
      },
    };
  }
  const rows = diffBrowseRows(beforeText ?? "", afterText ?? "");
  const changed = rows.some((row) => row.kind !== "same");
  return {
    ok: true,
    diff: {
      ...base,
      change: changed ? "changed" : "same",
      beforeText,
      afterText,
      rows,
    },
  };
}
