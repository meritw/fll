import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "cn";

export type TeamFileRow = {
  path: string;
  href: string;
  current: boolean;
  note: string | null;
};

export type TeamCodeLine = {
  no: number;
  html: string;
  mark: "plain" | "add" | "del";
};

export type TeamVersionChip = {
  href: string;
  current: boolean;
  title: string;
  detail: string | null;
  caption: string | null;
};

function fileName(path: string) {
  const slash = path.lastIndexOf("/");
  if (slash === -1) {
    return <span className="text-lg leading-snug font-semibold">{path}</span>;
  }
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-lg leading-snug font-semibold">{path.slice(slash + 1)}</span>
      <span className="truncate text-sm text-muted-foreground">{path.slice(0, slash)}</span>
    </span>
  );
}

function FileList({ rows, label }: { rows: TeamFileRow[]; label: string }) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground">No files in this version.</p>;
  }
  return (
    <ul aria-label={label} className="flex min-w-0 flex-col gap-2">
      {rows.map((row) => (
        <li key={row.path}>
          <Link
            href={row.href}
            aria-current={row.current ? "true" : undefined}
            className={cn(
              "flex min-h-16 items-center justify-between gap-3 rounded-2xl px-4 py-2.5",
              row.current ? "bg-brand-soft ring-2 ring-primary" : "bg-card ring-1 ring-line hover:bg-muted/60",
            )}
          >
            {fileName(row.path)}
            {row.note ? <span className="shrink-0 text-sm text-muted-foreground">{row.note}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function lineClass(mark: TeamCodeLine["mark"]) {
  if (mark === "add") {
    return "bg-present-tint";
  }
  if (mark === "del") {
    return "bg-destructive/10";
  }
  return "";
}

export function TeamFiles({
  notes,
  chips,
  olderHref,
  banner,
  rows,
  selectedPath,
  lines,
  codeNote,
  binaryPath,
  tooBig,
  changesHref,
  codeHref,
}: {
  notes: string[];
  chips: TeamVersionChip[];
  olderHref: string | null;
  banner: { text: string; latestHref: string } | null;
  rows: TeamFileRow[];
  selectedPath: string | null;
  lines: TeamCodeLine[];
  codeNote: string | null;
  binaryPath: string | null;
  tooBig: boolean;
  changesHref: string | null;
  codeHref: string | null;
}) {
  const summary = selectedPath ? `Files (${rows.length}) · ${selectedPath}` : `Files (${rows.length})`;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-sm tracking-[0.08em] text-primary uppercase">Code</p>
        <h1 className="mt-1 text-4xl font-semibold sm:text-5xl">Team code</h1>
      </div>

      {notes.map((note) => (
        <p key={note} className="rounded-2xl bg-info-soft px-4 py-3 text-info-ink">
          {note}
        </p>
      ))}

      <nav aria-label="Versions" className="flex gap-2 overflow-x-auto pb-1">
        {chips.map((chip) => (
          <Link
            key={chip.href + chip.title}
            href={chip.href}
            aria-current={chip.current ? "true" : undefined}
            className={cn(
              "flex min-h-14 w-56 shrink-0 flex-col justify-center rounded-xl px-3 py-2",
              chip.current ? "bg-brand-soft ring-2 ring-primary" : "bg-card ring-1 ring-line hover:bg-muted/60",
            )}
          >
            <span className="line-clamp-2 text-base leading-snug font-semibold">{chip.title}</span>
            {chip.detail ? <span className="truncate text-sm text-muted-foreground">{chip.detail}</span> : null}
            {chip.caption ? <span className="font-mono text-xs text-muted-foreground">{chip.caption}</span> : null}
          </Link>
        ))}
        {olderHref ? (
          <Link
            href={olderHref}
            className="flex min-h-14 shrink-0 items-center rounded-xl bg-card px-4 ring-1 ring-line hover:bg-muted/60"
          >
            Older versions
          </Link>
        ) : null}
      </nav>

      {banner ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-brand-soft px-4 py-4 ring-1 ring-primary sm:flex-row sm:items-center sm:justify-between">
          <p className="text-lg">{banner.text}</p>
          <Button asChild size="xl">
            <Link href={banner.latestHref}>Go to latest</Link>
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="lg:w-[340px] lg:shrink-0">
          <details className="lg:hidden">
            <summary className="flex min-h-14 cursor-pointer list-none items-center rounded-2xl bg-card px-4 font-semibold ring-1 ring-line">
              {summary}
            </summary>
            <div className="mt-2">
              <FileList rows={rows} label="Files" />
            </div>
          </details>
          <div className="hidden lg:block">
            <FileList rows={rows} label="Files" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">{selectedPath ?? "Team code"}</h2>
            {changesHref ? (
              <Link href={changesHref} className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-base">
                Show what changed
              </Link>
            ) : null}
            {codeHref ? (
              <Link href={codeHref} className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-base">
                Back to the code
              </Link>
            ) : null}
          </div>

          {codeNote ? <p className="mb-3 text-lg">{codeNote}</p> : null}
          {binaryPath ? (
            <p className="text-lg">
              This file is not Python.{" "}
              <a className="font-medium underline underline-offset-4" href="/api/team-project/download">
                Download the project zip
              </a>{" "}
              to open it.
            </p>
          ) : null}
          {tooBig ? (
            <p className="text-lg">
              This file is too big to show here.{" "}
              <a className="font-medium underline underline-offset-4" href="/api/team-project/download">
                Download the project zip
              </a>
              .
            </p>
          ) : null}

          {lines.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-line">
              <div className="w-max min-w-full py-3 font-mono text-base leading-6 sm:text-lg">
                {lines.map((line, index) => (
                  <div
                    id={`L${line.no}`}
                    key={`${line.mark}-${line.no}-${index}`}
                    className={cn("flex whitespace-pre px-3", lineClass(line.mark))}
                  >
                    <span className="inline-block w-6 shrink-0 select-none text-muted-foreground">
                      {line.mark === "add" ? "+" : line.mark === "del" ? "-" : " "}
                    </span>
                    <span className="inline-block w-10 shrink-0 select-none pr-3 text-right text-muted-foreground tabular-nums">
                      {line.no}
                    </span>
                    <span dangerouslySetInnerHTML={{ __html: line.html.length > 0 ? line.html : " " }} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
