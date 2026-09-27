import type { Metadata } from "next";
import Link from "next/link";

import { CalendarSubscribe } from "@/components/calendar-subscribe";
import { AddMeetingForm } from "@/components/meeting-forms";
import { MeetingCalendar } from "@/components/meeting-calendar";
import { Separator } from "@/components/ui/separator";
import { meetingsIcsSubscribeUrl, meetingsIcsToken } from "@/lib/ics";
import { listMeetingsForMonth, listUpcomingMeetings } from "@/lib/meetings";
import { formatMeetingWhen, teamDateKey, TEAM_TIME_ZONE, TEAM_TIME_ZONE_ABBR } from "@/lib/timezone";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Meetings",
};

function parseMonth(raw: string | undefined, fallback: Date) {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [year, month] = raw.split("-").map(Number);
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
      return { year, month };
    }
  }
  const key = teamDateKey(fallback);
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  };
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const now = new Date();
  const { year, month } = parseMonth(params.month, now);
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  const [monthMeetings, upcoming] = await Promise.all([
    listMeetingsForMonth(year, month),
    listUpcomingMeetings(12),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Meetings</h1>
        <p className="text-lg text-muted-foreground">
          Monday and Thursday evenings ({TEAM_TIME_ZONE}, 6–8 PM {TEAM_TIME_ZONE_ABBR}). Open a
          night to fill the engineering notebook page (attendance, progress, actions, lessons).
        </p>
      </div>

      <MeetingCalendar
        year={year}
        month={month}
        meetings={monthMeetings}
        label={monthLabel(year, month)}
        prevHref={`/meetings?month=${prev.year}-${String(prev.month).padStart(2, "0")}`}
        nextHref={`/meetings?month=${next.year}-${String(next.month).padStart(2, "0")}`}
      />

      <CalendarSubscribe
        subscribeUrl={meetingsIcsSubscribeUrl()}
        tokenRequired={Boolean(meetingsIcsToken())}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Coming up</h2>
        {upcoming.length === 0 ? (
          <p>No upcoming meetings yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {upcoming.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/meetings/${item.id}`}
                  className="block rounded-xl bg-card px-4 py-4 text-lg ring-1 ring-foreground/10 underline-offset-4 hover:underline"
                >
                  <span className="font-medium">
                    {item.sessionNumber != null
                      ? `Session ${item.sessionNumber}`
                      : item.title?.trim() || "Team meeting"}
                  </span>
                  <span className="mt-1 block text-muted-foreground">
                    {formatMeetingWhen(item.startsAt, item.endsAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Separator />
      <AddMeetingForm defaultDate={teamDateKey(now)} />
    </div>
  );
}
