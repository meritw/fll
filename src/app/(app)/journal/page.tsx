import type { Metadata } from "next";
import Link from "next/link";

import { JournalEntryForm } from "@/components/journal-form";
import { Separator } from "@/components/ui/separator";
import { listJournalEntries } from "@/lib/journal";
import { listRecentMeetings } from "@/lib/meetings";
import { requireUser } from "@/lib/session";
import { formatMeetingWhen, formatTeamStamp, TEAM_TIME_ZONE_ABBR } from "@/lib/timezone";

export const metadata: Metadata = {
  title: "Journal",
};

export default async function JournalPage() {
  await requireUser();
  const [entries, meetings] = await Promise.all([
    listJournalEntries(),
    listRecentMeetings(30),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Engineering journal</h1>
        <p className="text-lg text-muted-foreground">
          Team build notes — anyone signed in can add an entry.
        </p>
      </div>

      <JournalEntryForm
        meetings={meetings.map((item) => ({
          id: item.id,
          label: `${item.title?.trim() || "Meeting"} · ${formatMeetingWhen(item.startsAt, item.endsAt)}`,
        }))}
      />

      <Separator />

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Entries</h2>
        {entries.length === 0 ? (
          <p>No journal entries yet.</p>
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
                      Related: {entry.relatedMeeting.title?.trim() || "Meeting"}
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
