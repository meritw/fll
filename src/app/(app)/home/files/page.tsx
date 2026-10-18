import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TeamFiles, type TeamCodeLine, type TeamFileRow, type TeamVersionChip } from "@/components/team-files";
import { highlightLines } from "@/lib/highlight";
import { isParent } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import { storageConfig } from "@/lib/storage";
import {
  diffFileAtCommit,
  getSnapshot,
  listChangedFiles,
  listCommits,
  MAX_BROWSE_TEXT_BYTES,
  pageBrowseCommits,
  parseBrowseQuery,
  pickBrowsePath,
  revKey,
  sortBrowsePaths,
  splitBrowseLines,
  type BrowseCommit,
  type BrowseFile,
  type BrowseRev,
  type BrowseSnapshot,
} from "@/lib/team-project/browse";
import { browseHref } from "@/lib/team-project/browse-url";
import { formatTeamStamp } from "@/lib/timezone";

export const metadata: Metadata = {
  title: "Team code",
};

export const runtime = "nodejs";

const TAPE_LIMIT = 24;

const changeNote = {
  added: "New",
  changed: "Changed",
  removed: "Removed",
} as const;

type PageProps = {
  searchParams: Promise<{
    file?: string | string[];
    sha?: string | string[];
    view?: string | string[];
    before?: string | string[];
  }>;
};

function decodeFile(file: BrowseFile): string | null {
  if (file.kind === "binary" || file.bytes.byteLength > MAX_BROWSE_TEXT_BYTES) {
    return null;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(file.bytes);
  } catch {
    return null;
  }
}

async function paint(text: string, kind: BrowseFile["kind"]): Promise<TeamCodeLine[]> {
  const html = await highlightLines(text, kind === "python" ? "python" : "plaintext");
  const count = Math.max(html.length, splitBrowseLines(text).length);
  const lines: TeamCodeLine[] = [];
  for (let i = 0; i < count; i += 1) {
    lines.push({ no: i + 1, html: html[i] ?? "", mark: "plain" });
  }
  return lines;
}

export default async function TeamFilesPage({ searchParams }: PageProps) {
  const session = await requireUser();
  if (isParent(session.user.role)) {
    redirect("/journal");
  }

  const query = parseBrowseQuery(await searchParams);
  const notes: string[] = [];
  if (query.shaRejected) {
    notes.push("That version was not found. Here is the latest code.");
  }
  if (query.fileRejected) {
    notes.push("That file name is not one we can open.");
  }

  let rev: BrowseRev = query.shaRejected ? "now" : query.rev;
  const stored = await getSnapshot(rev);
  let snapshot: BrowseSnapshot | null = stored.ok ? stored.snapshot : null;
  if (!stored.ok && stored.reason === "unknown_rev") {
    notes.push("That version was not found. Here is the latest code.");
    rev = "now";
    const latest = await getSnapshot("now");
    snapshot = latest.ok ? latest.snapshot : null;
  }

  const history = await listCommits();
  const page = pageBrowseCommits(history.commits, { limit: TAPE_LIMIT, before: query.before });
  const commits = page.commits;
  const snapshots = new Map<string, BrowseSnapshot>();
  if (snapshot) {
    snapshots.set(revKey(rev), snapshot);
  }
  const shown = snapshots.get(revKey(rev)) ?? null;

  if (!shown) {
    return (
      <TeamFiles
        notes={[
          storageConfig()
            ? "The team code could not be opened. Ask a coach."
            : "File saving is not set up yet. Ask a coach.",
        ]}
        chips={chipsFor(rev, commits, null)}
        olderHref={olderHref(page.nextBefore, null, rev)}
        banner={null}
        rows={[]}
        selectedPath={null}
        lines={[]}
        codeNote={null}
        binaryPath={null}
        tooBig={false}
        changesHref={null}
        codeHref={null}
      />
    );
  }

  const storageReady = Boolean(storageConfig());
  if (!storageReady) {
    notes.unshift("File saving is not set up yet. Ask a coach.");
  }
  if (shown.starter) {
    notes.push("This is the starter code. It changes after the first upload.");
  }

  const viewingChanges = rev !== "now" && query.changes;
  const changeByPath = new Map<string, "added" | "changed" | "removed">();
  if (rev !== "now" && query.changes) {
    const changes = await listChangedFiles(rev.sha);
    if (changes.ok) {
      for (const file of changes.files) {
        changeByPath.set(file.path, file.kind);
      }
    }
  }
  const paths = sortBrowsePaths([...new Set([...shown.files.keys(), ...changeByPath.keys()])]);
  const requested = query.file;
  const selected = chosenPath(requested, shown, changeByPath);
  const missing = Boolean(requested) && !selected;

  const sha = rev === "now" ? null : rev.sha;
  const rows: TeamFileRow[] = paths.map((path) => ({
    path,
    href: browseHref({ file: path, sha, changes: viewingChanges, before: query.before }),
    current: path === selected,
    note: changeNoteFor(changeByPath.get(path)),
  }));

  const code = await codePane({
    shown,
    selected,
    missing,
    viewingChanges,
    sha,
  });

  const commit = sha ? history.commits.find((item) => item.sha === sha) ?? null : null;
  const banner =
    commit && sha !== shown.headSha
      ? {
          text: `You are looking at an older version from ${formatTeamStamp(commit.createdAt)} by ${commit.uploaderName}. ${commit.message}`,
          latestHref: browseHref({ file: selected }),
        }
      : null;

  const changesHref =
    !viewingChanges && selected && (sha || shown.headSha)
      ? browseHref({ file: selected, sha: sha ?? shown.headSha, changes: true })
      : null;
  const codeHref = viewingChanges ? browseHref({ file: selected, sha, before: query.before }) : null;

  return (
    <TeamFiles
      notes={notes}
      chips={chipsFor(rev, commits, selected ?? query.file)}
      olderHref={olderHref(page.nextBefore, selected ?? query.file, rev, viewingChanges)}
      banner={banner}
      rows={rows}
      selectedPath={selected}
      lines={code.lines}
      codeNote={code.note}
      binaryPath={code.binaryPath}
      tooBig={code.tooBig}
      changesHref={changesHref}
      codeHref={codeHref}
    />
  );
}

function chosenPath(
  requested: string | null,
  shown: BrowseSnapshot,
  changeByPath: Map<string, "added" | "changed" | "removed">,
): string | null {
  if (!requested) {
    return pickBrowsePath(shown.files);
  }
  if (shown.files.has(requested) || changeByPath.get(requested) === "removed") {
    return requested;
  }
  return null;
}

function changeNoteFor(kind: "added" | "changed" | "removed" | undefined) {
  if (!kind) {
    return null;
  }
  return changeNote[kind];
}

function chipsFor(rev: BrowseRev, commits: BrowseCommit[], file: string | null): TeamVersionChip[] {
  const now: TeamVersionChip = {
    href: browseHref({ file }),
    current: rev === "now",
    title: "Now",
    detail: null,
    caption: null,
  };
  const older = commits.map((commit) => ({
    href: browseHref({ sha: commit.sha, file: file ?? "main.py" }),
    current: rev !== "now" && rev.sha === commit.sha,
    title: commit.message || "Saved version",
    detail: `${commit.uploaderName} · ${formatTeamStamp(commit.createdAt)}`,
    caption: commit.sha.slice(0, 7),
  }));
  return [now, ...older];
}

function olderHref(
  nextBefore: string | null,
  file: string | null,
  rev: BrowseRev,
  changes = false,
): string | null {
  if (!nextBefore) {
    return null;
  }
  return browseHref({
    file,
    sha: rev === "now" ? null : rev.sha,
    changes,
    before: nextBefore,
  });
}

async function codePane(input: {
  shown: BrowseSnapshot;
  selected: string | null;
  missing: boolean;
  viewingChanges: boolean;
  sha: string | null;
}): Promise<{ lines: TeamCodeLine[]; note: string | null; binaryPath: string | null; tooBig: boolean }> {
  if (input.missing) {
    return { lines: [], note: "This version does not have that file.", binaryPath: null, tooBig: false };
  }
  if (!input.selected) {
    return { lines: [], note: null, binaryPath: null, tooBig: false };
  }
  if (input.viewingChanges && input.sha) {
    return diffPane(input.sha, input.selected);
  }
  const file = input.shown.files.get(input.selected);
  if (!file) {
    return { lines: [], note: "This version does not have that file.", binaryPath: null, tooBig: false };
  }
  if (file.kind === "binary") {
    return { lines: [], note: null, binaryPath: file.path, tooBig: false };
  }
  if (file.bytes.byteLength > MAX_BROWSE_TEXT_BYTES) {
    return { lines: [], note: null, binaryPath: null, tooBig: true };
  }
  const text = decodeFile(file);
  if (text == null) {
    return { lines: [], note: null, binaryPath: file.path, tooBig: false };
  }
  return { lines: await paint(text, file.kind), note: null, binaryPath: null, tooBig: false };
}

async function diffPane(
  sha: string,
  path: string,
): Promise<{ lines: TeamCodeLine[]; note: string | null; binaryPath: string | null; tooBig: boolean }> {
  const result = await diffFileAtCommit(sha, path);
  if (!result.ok) {
    return { lines: [], note: "This version does not have that file.", binaryPath: null, tooBig: false };
  }
  const diff = result.diff;
  if (diff.change === "binary") {
    return { lines: [], note: null, binaryPath: path, tooBig: false };
  }
  if (diff.change === "too_big") {
    return { lines: [], note: null, binaryPath: null, tooBig: true };
  }
  if (diff.change === "missing") {
    return { lines: [], note: "This version does not have that file.", binaryPath: null, tooBig: false };
  }
  const kind = path.toLowerCase().endsWith(".py") ? "python" : "text";
  if (diff.change === "added" && diff.afterText != null) {
    return { lines: await paint(diff.afterText, kind), note: "Added in this version.", binaryPath: null, tooBig: false };
  }
  if (diff.change === "removed" && diff.beforeText != null) {
    return {
      lines: await paint(diff.beforeText, kind),
      note: "This file was removed in this version.",
      binaryPath: null,
      tooBig: false,
    };
  }
  if (diff.change === "same" && diff.afterText != null) {
    return {
      lines: await paint(diff.afterText, kind),
      note: "This file is the same as the one before it.",
      binaryPath: null,
      tooBig: false,
    };
  }
  const beforeHtml = diff.beforeText != null ? await highlightLines(diff.beforeText, kind === "python" ? "python" : "plaintext") : [];
  const afterHtml = diff.afterText != null ? await highlightLines(diff.afterText, kind === "python" ? "python" : "plaintext") : [];
  const lines: TeamCodeLine[] = diff.rows.map((row) => {
    if (row.kind === "del") {
      return { no: row.oldNo, html: beforeHtml[row.oldNo - 1] ?? "", mark: "del" as const };
    }
    if (row.kind === "add") {
      return { no: row.newNo, html: afterHtml[row.newNo - 1] ?? "", mark: "add" as const };
    }
    return { no: row.newNo, html: afterHtml[row.newNo - 1] ?? "", mark: "plain" as const };
  });
  return { lines, note: null, binaryPath: null, tooBig: false };
}
