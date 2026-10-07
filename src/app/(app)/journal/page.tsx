import type { Metadata } from "next";
import Link from "next/link";

import { JournalEntryForm } from "@/components/journal-form";
import { Separator } from "@/components/ui/separator";
import { listJournalEntries } from "@/lib/journal";
import { listNotebookSessions, listRecentMeetings } from "@/lib/meetings";
import { requireUser } from "@/lib/session";
import { formatMeetingWhen, formatTeamDay, formatTeamStamp, TEAM_TIME_ZONE_ABBR } from "@/lib/timezone";

export const metadata: Metadata = {
  title: "Journal",
};

export default async function JournalPage() {
  await requireUser();
  const [sessions, entries, meetings] = await Promise.all([
    listNotebookSessions(40),
    listJournalEntries(),
    listRecentMeetings(30),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Engineering notebook</h1>
        <p className="text-lg text-muted-foreground">
          Each meeting night is a notebook page: attendance, today’s progress, action items, and
          lessons learned. Open a session to fill it in.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Sessions</h2>
        {sessions.length === 0 ? (
          <p>No filled sessions yet. Check Meetings for the calendar.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/meetings/${session.id}`}
                  className="block rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10 underline-offset-4 hover:underline"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-lg">
                    <span className="font-semibold">
                      {session.sessionNumber != null
                        ? `Session ${session.sessionNumber}`
                        : session.title?.trim() || "Session"}
                    </span>
                    <span className="text-muted-foreground">{formatTeamDay(session.startsAt)}</span>
                  </div>
                  <p className="mt-1 text-base text-muted-foreground">
                    {formatMeetingWhen(session.startsAt, session.endsAt)}
                  </p>
                  <p className="mt-2 text-base text-muted-foreground">
                    {session.attendeeCount} here · {session.progressCount} progress ·{" "}
                    {session.actionCount} actions · {session.lessonCount} lessons
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <ButtonishLink href="/meetings">Open meetings calendar</ButtonishLink>
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold">Extra notes</h2>
          <p className="text-muted-foreground">
            Optional freeform notes that are not part of a session page (still tracks who wrote
            them).
          </p>
        </div>
        <JournalEntryForm
          meetings={meetings.map((item) => ({
            id: item.id,
            label: `${item.sessionNumber != null ? `Session ${item.sessionNumber}` : item.title?.trim() || "Meeting"} · ${formatMeetingWhen(item.startsAt, item.endsAt)}`,
          }))}
        />
        {entries.length === 0 ? (
          <p className="text-muted-foreground">No extra notes yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl bg-card px-4 py-5 ring-1 ring-foreground/10"
              >
                {entry.title ? (
                  <h3 className="mb-2 text-xl font-semibold">{entry.title}</h3>
                ) : null}
                <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-base text-muted-foreground">
                  <span className="font-medium text-foreground">{entry.authorName}</span>
                  <span>
                    {formatTeamStamp(entry.createdAt)} {TEAM_TIME_ZONE_ABBR}
                  </span>
                  {entry.relatedMeeting ? (
                    <Link
                      href={`/meetings/${entry.relatedMeeting.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      Related:{" "}
                      {entry.relatedMeeting.title?.trim() || "Session"}
                    </Link>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap text-lg">{entry.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
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
