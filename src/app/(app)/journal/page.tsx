import type { Metadata } from "next";
import Link from "next/link";

import { JournalEntryForm } from "@/components/journal-form";
import { JournalSessionCard } from "@/components/journal-session-card";
import { Separator } from "@/components/ui/separator";
import { listJournalEntries } from "@/lib/journal";
import { listNotebookSessions, listRecentMeetings } from "@/lib/meetings";
import { requireUser } from "@/lib/session";
import {
  formatMeetingWhen,
  formatTeamStamp,
  TEAM_TIME_ZONE_ABBR,
} from "@/lib/timezone";

export const metadata: Metadata = {
  title: "Journal",
};

type TimelineSession = {
  kind: "session";
  sortAt: number;
  session: Awaited<ReturnType<typeof listNotebookSessions>>[number];
};

type TimelineNote = {
  kind: "note";
  sortAt: number;
  entry: Awaited<ReturnType<typeof listJournalEntries>>[number];
};

type TimelineItem = TimelineSession | TimelineNote;

export default async function JournalPage() {
  await requireUser();
  const [sessions, entries, meetings] = await Promise.all([
    listNotebookSessions(40),
    listJournalEntries(),
    listRecentMeetings(30),
  ]);

  const timeline: TimelineItem[] = [
    ...sessions.map(
      (session): TimelineSession => ({
        kind: "session",
        sortAt: session.startsAt.getTime(),
        session,
      }),
    ),
    ...entries.map(
      (entry): TimelineNote => ({
        kind: "note",
        sortAt: entry.createdAt.getTime(),
        entry,
      }),
    ),
  ].sort((left, right) => right.sortAt - left.sortAt);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Engineering notebook</h1>
        <p className="text-lg text-muted-foreground">
          Meeting nights and extra notes in one timeline. Read what the team wrote, then open a
          session if you need to edit.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <JournalEntryForm
          meetings={meetings.map((item) => ({
            id: item.id,
            label: `${item.sessionNumber != null ? `Session ${item.sessionNumber}` : item.title?.trim() || "Meeting"} · ${formatMeetingWhen(item.startsAt, item.endsAt)}`,
          }))}
        />
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold">Timeline</h2>
          <p className="text-muted-foreground">
            Sessions and extra notes, newest first. Extra notes sit in the same list as meetings.
          </p>
        </div>

        {timeline.length === 0 ? (
          <p className="text-muted-foreground">
            Nothing here yet. Fill a meeting session or add an extra note above.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {timeline.map((item) =>
              item.kind === "session" ? (
                <li key={`session-${item.session.id}`}>
                  <JournalSessionCard {...item.session} />
                </li>
              ) : (
                <li key={`note-${item.entry.id}`}>
                  <ExtraNoteCard entry={item.entry} />
                </li>
              ),
            )}
          </ul>
        )}

        <ButtonishLink href="/meetings">Open meetings calendar</ButtonishLink>
      </section>
    </div>
  );
}

function ExtraNoteCard({
  entry,
}: {
  entry: Awaited<ReturnType<typeof listJournalEntries>>[number];
}) {
  return (
    <article className="rounded-xl bg-card px-4 py-5 ring-1 ring-foreground/10">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Extra note
      </p>
      {entry.title ? <h3 className="mt-1 text-xl font-semibold">{entry.title}</h3> : null}
      <div className="mt-2 mb-3 flex flex-wrap gap-x-3 gap-y-1 text-base text-muted-foreground">
        <span className="font-medium text-foreground">{entry.authorName}</span>
        <span>
          {formatTeamStamp(entry.createdAt)} {TEAM_TIME_ZONE_ABBR}
        </span>
        {entry.relatedMeeting ? (
          <Link
            href={`/meetings/${entry.relatedMeeting.id}`}
            className="underline-offset-4 hover:underline"
          >
            Related: {entry.relatedMeeting.title?.trim() || "Session"}
          </Link>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap text-lg">{entry.body}</p>
    </article>
  );
}

function ButtonishLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-12 items-center justify-center self-start rounded-lg bg-secondary px-5 text-lg font-medium text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]"
    >
      {children}
    </Link>
  );
}
