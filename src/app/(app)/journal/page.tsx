import type { Metadata } from "next";

import {
  AddToJournal,
  buildTimeline,
  JOURNAL_FILTERS,
  Sidebar,
  SeasonCard,
  Timeline,
  TodayCard,
  type JournalFilter,
} from "@/components/journal-timeline";
import { listStudents } from "@/lib/accounts";
import { listJournalEntries, listSeasonEvents } from "@/lib/journal";
import { countMeetingMedia, listGalleryMedia } from "@/lib/media";
import {
  findMeetingForDay,
  listNotebookSessions,
  peekNextSessionNumber,
} from "@/lib/meetings";
import { countMissionStatusEvents, listMissionBoard } from "@/lib/missions-board";
import { isCoach, isParent } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import { teamDateKey } from "@/lib/timezone";

export const metadata: Metadata = {
  title: "Journal",
};

type PageProps = {
  searchParams: Promise<{ show?: string | string[] }>;
};

function readFilter(value: string | string[] | undefined): JournalFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return JOURNAL_FILTERS.find((filter) => filter.key === raw)?.key ?? "all";
}

export default async function JournalPage({ searchParams }: PageProps) {
  const session = await requireUser();
  const filter = readFilter((await searchParams).show);
  const parent = isParent(session.user.role);
  const now = new Date();

  const [
    sessions,
    entries,
    board,
    students,
    seasonEvents,
    latestMedia,
    todayMeeting,
    nextSession,
    robotUpdates,
    mediaCount,
  ] = await Promise.all([
    listNotebookSessions(),
    listJournalEntries(),
    listMissionBoard(),
    listStudents(),
    listSeasonEvents(),
    listGalleryMedia(6),
    findMeetingForDay(teamDateKey(now)),
    peekNextSessionNumber(),
    countMissionStatusEvents(),
    countMeetingMedia(),
  ]);

  const todayInTimeline = Boolean(
    todayMeeting && sessions.some((item) => item.id === todayMeeting.id),
  );
  const items = buildTimeline(sessions, entries, filter);
  const expandedIds = new Set<string>();
  const newestMeeting = sessions[0];
  if (newestMeeting) {
    expandedIds.add(newestMeeting.id);
  }
  if (todayMeeting) {
    expandedIds.add(todayMeeting.id);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex max-w-2xl flex-col gap-2">
        <p className="font-mono text-sm tracking-widest text-primary uppercase">
          Team 55900 · 2026–27 season
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-[44px] sm:leading-[1.1]">
          Our season journal
        </h1>
        <p className="text-lg text-ink-muted">
          Everything our team did this season, in order. Add today&apos;s work below, and scroll
          down to see how far we&apos;ve come.
        </p>
      </header>

      <SeasonCard
        entries={entries}
        seasonEvents={seasonEvents}
        board={board}
        sessionCount={sessions.length}
        robotUpdates={robotUpdates}
        mediaCount={mediaCount}
        coach={isCoach(session.user.role)}
        now={now}
      />

      <AddToJournal parent={parent} />

      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-col gap-6" style={{ flex: "999 1 560px" }}>
          {todayInTimeline ? null : (
            <TodayCard
              nextSession={nextSession}
              todayMeeting={
                todayMeeting
                  ? { id: todayMeeting.id, sessionNumber: todayMeeting.sessionNumber }
                  : null
              }
              parent={parent}
            />
          )}
          <Timeline
            items={items}
            students={students.map((student) => ({ id: student.id, name: student.name }))}
            expandedIds={expandedIds}
            filter={filter}
          />
        </div>
        <div className="min-w-0" style={{ flex: "1 1 320px" }}>
          <Sidebar
            board={board}
            students={students.map((student) => ({ id: student.id, name: student.name }))}
            sessions={sessions}
            latestMedia={latestMedia}
            mediaCount={mediaCount}
          />
        </div>
      </div>
    </div>
  );
}
