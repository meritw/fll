import type { Metadata } from "next";
import Link from "next/link";
import { Bot, Camera, CircleCheck, Pencil } from "lucide-react";
import { cn } from "cn";

import { JumpToMonth } from "@/components/journal/jump-to-month";
import { MediaThumb } from "@/components/journal/media-thumb";
import { SeasonCard, type SeasonPoint } from "@/components/journal/season-card";
import { StatusBar, StatusPill } from "@/components/journal/status-pill";
import {
  LooseNoteCard,
  MilestoneCard,
  SessionCard,
  SessionSummaryCard,
  TimelineRow,
} from "@/components/journal/timeline";
import { listStudents } from "@/lib/accounts";
import { startTodayMeeting } from "@/lib/actions";
import {
  entryHeadline,
  journalEntryAt,
  listJournalEntries,
  listSeasonEvents,
  type JournalEntryItem,
} from "@/lib/journal";
import { countMedia, listGalleryMedia } from "@/lib/media";
import {
  findTodayMeeting,
  listSessionRecords,
  nextSessionNumber,
  sessionLabel,
  todayKey,
  type SessionRecord,
} from "@/lib/meetings";
import { isWorking, missionCode, type MissionStatus } from "@/lib/mission-status";
import { countStatusEvents, listMissionBoard } from "@/lib/missions-board";
import { isCoach, isParent } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import { teamDateKey, TEAM_TIME_ZONE } from "@/lib/timezone";

export const metadata: Metadata = {
  title: "Journal",
};

const FILTERS = ["all", "meetings", "notes", "media", "robot", "milestones"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABELS: Record<Filter, string> = {
  all: "Everything",
  meetings: "Meetings",
  notes: "Notes",
  media: "Photos & video",
  robot: "Robot updates",
  milestones: "Milestones",
};

type Item =
  | { kind: "session"; at: Date; record: SessionRecord }
  | { kind: "milestone"; at: Date; entry: JournalEntryItem }
  | { kind: "note"; at: Date; entry: JournalEntryItem };

const monthFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TEAM_TIME_ZONE,
  month: "long",
  year: "numeric",
});

function keep(item: Item, show: Filter) {
  if (show === "all") return true;
  if (item.kind === "milestone") return show === "milestones";
  if (item.kind === "note") return show === "notes";
  const record = item.record;
  if (show === "meetings") return true;
  if (show === "notes") {
    return (
      record.progress.length + record.lessons.length + record.actions.length + record.otherNotes.length >
      0
    );
  }
  if (show === "media") return record.media.length > 0;
  if (show === "robot") return record.robot.length > 0 || record.missionNotes.length > 0;
  return false;
}

type PageProps = {
  searchParams: Promise<{ show?: string }>;
};

export default async function JournalPage({ searchParams }: PageProps) {
  const session = await requireUser();
  const coach = isCoach(session.user.role);
  const parent = isParent(session.user.role);
  const { show: showParam } = await searchParams;
  const show: Filter = (FILTERS as readonly string[]).includes(showParam ?? "")
    ? (showParam as Filter)
    : "all";

  const [records, entries, board, students, seasonEvents, latestMedia, mediaCount, robotCount, today] =
    await Promise.all([
      listSessionRecords(),
      listJournalEntries(),
      listMissionBoard(),
      listStudents(),
      listSeasonEvents(),
      listGalleryMedia(6),
      countMedia(),
      countStatusEvents(),
      findTodayMeeting(),
    ]);
  const upcomingNumber = today ? null : await nextSessionNumber();
  const todayDay = todayKey();

  // Timeline: meetings, milestones, and notes not tied to a meeting.
  // Meeting-linked milestones/notes use the meeting day, not insert time.
  const all: Item[] = [
    ...records.map((record): Item => ({ kind: "session", at: record.startsAt, record })),
    ...entries
      .filter((entry) => entry.milestone)
      .map((entry): Item => ({ kind: "milestone", at: journalEntryAt(entry), entry })),
    ...entries
      .filter((entry) => !entry.milestone && !entry.relatedMeeting)
      .map((entry): Item => ({ kind: "note", at: journalEntryAt(entry), entry })),
  ].sort((left, right) => right.at.getTime() - left.at.getTime());
  const items = all.filter((item) => keep(item, show));
  const newestSessionId = records[0]?.id;
  // Records are newest first; the oldest one is where the season strip starts.
  const firstMeeting = records.at(-1);

  const months: { id: string; label: string; items: Item[] }[] = [];
  for (const item of items) {
    const key = teamDateKey(item.at).slice(0, 7);
    const last = months.at(-1);
    if (last?.id === `m-${key}`) {
      last.items.push(item);
    } else {
      months.push({ id: `m-${key}`, label: monthFormat.format(item.at), items: [item] });
    }
  }

  // Season strip + stats.
  const points: SeasonPoint[] = [
    ...entries
      .filter((entry) => entry.milestone)
      .map((entry) => ({
        key: `ms-${entry.id}`,
        dayKey: teamDateKey(journalEntryAt(entry)),
        label: entryHeadline(entry),
        kind: "milestone" as const,
      })),
    ...seasonEvents.map((event) => ({
      key: `ev-${event.id}`,
      dayKey: event.dayKey,
      label: event.title,
      kind: "event" as const,
      eventId: event.id,
    })),
  ];
  const counts: Record<MissionStatus, number> = { none: 0, trying: 0, some: 0, every: 0 };
  for (const item of board) counts[item.status] += 1;
  const working = board.filter((item) => isWorking(item.status)).length;
  const stats = [
    { value: String(records.length), label: records.length === 1 ? "meeting" : "meetings" },
    { value: `${working} of ${board.length}`, label: "missions working" },
    { value: String(robotCount), label: robotCount === 1 ? "robot update" : "robot updates" },
    { value: String(mediaCount), label: "photos and videos" },
  ];

  // Attendance over the last 8 meetings that took attendance (oldest → newest).
  const attendanceMeetings = records.filter((record) => record.attendees.length > 0).slice(0, 8).reverse();

  const addButtons = [
    {
      tab: "attend",
      title: "Who's here today",
      hint: "Tap your name when you arrive",
      icon: CircleCheck,
      primary: true,
      forParents: false,
    },
    {
      tab: "note",
      title: "Write a note",
      hint: "What we did, learned, or need to do next",
      icon: Pencil,
      forParents: true,
    },
    {
      tab: "media",
      title: "Add photos or video",
      hint: "Parents and coaches too",
      icon: Camera,
      forParents: true,
    },
    {
      tab: "robot",
      title: "Robot update",
      hint: "Which missions worked today",
      icon: Bot,
      forParents: false,
    },
  ].filter((button) => !parent || button.forParents);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-sm tracking-[0.08em] text-primary uppercase">
            Team 55900 · 2026–27 season
          </p>
          <h1 className="text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
            Our season journal
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Everything our team did this season, in order. Add today&apos;s work below, and scroll
            down to see how far we&apos;ve come.
          </p>
        </div>
        <SeasonCard
          points={points}
          today={todayDay}
          firstMeetingDay={firstMeeting ? teamDateKey(firstMeeting.startsAt) : null}
          stats={stats}
          coach={coach}
        />
      </section>

      <section aria-labelledby="add-heading" className="flex flex-col gap-3">
        <h2 id="add-heading" className="text-2xl font-semibold">
          Add to the journal
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {addButtons.map((button) => {
            const Icon = button.icon;
            return (
              <Link
                key={button.tab}
                href={`/journal/today?tab=${button.tab}`}
                className={cn(
                  "flex min-h-24 flex-col gap-2 rounded-2xl p-4 sm:flex-row sm:items-start sm:gap-3.5",
                  button.primary
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-card ring-1 ring-line hover:bg-muted/50",
                )}
              >
                <Icon
                  className={cn(
                    "size-7 shrink-0",
                    button.primary ? "" : button.tab === "media" ? "text-info" : "text-primary",
                  )}
                  aria-hidden
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-lg leading-snug font-semibold">{button.title}</span>
                  <span
                    className={cn(
                      "hidden text-base sm:block",
                      button.primary ? "opacity-90" : "text-muted-foreground",
                    )}
                  >
                    {button.hint}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-8">
        <section aria-labelledby="timeline-heading" className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="timeline-heading" className="text-3xl font-bold">
              Timeline
            </h2>
            <JumpToMonth months={months.map((month) => ({ id: month.id, label: month.label }))} />
          </div>
          <nav aria-label="Show" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap">
            {FILTERS.map((key) => (
              <Link
                key={key}
                href={key === "all" ? "/journal" : `/journal?show=${key}`}
                aria-current={show === key ? "true" : undefined}
                scroll={false}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-base whitespace-nowrap",
                  show === key
                    ? "border-foreground bg-foreground text-background"
                    : "border-line bg-card hover:bg-muted",
                )}
              >
                {FILTER_LABELS[key]}
              </Link>
            ))}
          </nav>

          {!today && !parent && show === "all" ? (
            <form
              action={startTodayMeeting}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-brand-soft p-4"
            >
              <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
                <span className="font-mono text-sm text-primary">MEETING TODAY?</span>
                <span className="text-lg font-semibold">Start Session {upcomingNumber}</span>
                <span className="text-base text-muted-foreground">
                  It also starts by itself when the first person taps their name in &ldquo;Who&apos;s
                  here today&rdquo;.
                </span>
              </div>
              <button
                type="submit"
                className="min-h-12 rounded-xl bg-primary px-5 text-lg font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Start meeting
              </button>
            </form>
          ) : null}

          {items.length === 0 ? (
            <p className="rounded-2xl bg-card p-5 text-lg text-muted-foreground ring-1 ring-line">
              {show === "all" ? (
                <>
                  Nothing here yet. Tap <span className="font-semibold">Who&apos;s here today</span>{" "}
                  when your meeting starts.
                </>
              ) : (
                "Nothing like that yet."
              )}
            </p>
          ) : null}

          {months.map((month, monthIndex) => (
            <div key={month.id} className="flex flex-col">
              <h3
                id={month.id}
                className="mb-4 scroll-mt-4 pl-13 font-mono text-sm font-semibold tracking-[0.1em] text-muted-foreground uppercase sm:pl-20"
              >
                {month.label}
              </h3>
              <ol className="flex flex-col">
                {month.items.map((item, index) => {
                  const last = monthIndex === months.length - 1 && index === month.items.length - 1;
                  if (item.kind === "milestone") {
                    return (
                      <TimelineRow key={`ms-${item.entry.id}`} date={item.at} last={last}>
                        <MilestoneCard entry={item.entry} />
                      </TimelineRow>
                    );
                  }
                  if (item.kind === "note") {
                    return (
                      <TimelineRow key={`note-${item.entry.id}`} date={item.at} last={last}>
                        <LooseNoteCard entry={item.entry} />
                      </TimelineRow>
                    );
                  }
                  const expanded =
                    item.record.id === newestSessionId || item.record.dayKey === todayDay;
                  return (
                    <TimelineRow key={item.record.id} date={item.at} last={last}>
                      {expanded ? (
                        <SessionCard record={item.record} students={students} mediaLimit={3} />
                      ) : (
                        <SessionSummaryCard record={item.record} studentCount={students.length} />
                      )}
                    </TimelineRow>
                  );
                })}
              </ol>
            </div>
          ))}
        </section>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
          <section
            aria-labelledby="progress-heading"
            className="flex flex-col gap-3.5 rounded-3xl bg-card p-5 ring-1 ring-line"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="progress-heading" className="text-xl font-semibold">
                Mission progress
              </h2>
              <span className="text-base text-muted-foreground">
                {working} of {board.length} working
              </span>
            </div>
            <StatusBar counts={counts} />
            <ul className="flex flex-col">
              {board.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/missions?m=${item.number}`}
                    className="flex min-h-11 items-center gap-2.5 border-b border-line/60 hover:bg-muted/50"
                  >
                    <span className="w-8 shrink-0 font-mono text-sm text-muted-foreground">
                      {missionCode(item.number)}
                    </span>
                    <span className="min-w-0 flex-1 text-base">{item.name}</span>
                    <StatusPill status={item.status} className="min-h-6 px-2 text-xs" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/missions" className="text-base font-semibold text-primary hover:underline">
              Open Missions to join one or add notes
            </Link>
          </section>

          {attendanceMeetings.length > 0 && students.length > 0 ? (
            <section
              aria-labelledby="attendance-heading"
              className="flex flex-col gap-3 rounded-3xl bg-card p-5 ring-1 ring-line"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 id="attendance-heading" className="text-xl font-semibold">
                  Attendance
                </h2>
                <span className="text-base text-muted-foreground">
                  Last {attendanceMeetings.length} {attendanceMeetings.length === 1 ? "meeting" : "meetings"}
                </span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {students.map((person) => {
                  const marks = attendanceMeetings.map((record) => ({
                    id: record.id,
                    here: record.attendees.some((item) => item.id === person.id),
                    label: sessionLabel(record),
                  }));
                  const here = marks.filter((mark) => mark.here).length;
                  return (
                    <li key={person.id} className="flex items-center gap-2.5">
                      <span className="w-20 shrink-0 truncate text-base">{person.name}</span>
                      <span
                        className="flex flex-1 gap-1"
                        role="img"
                        aria-label={`${person.name}: here ${here} of ${marks.length}`}
                      >
                        {marks.map((mark) => (
                          <span
                            key={mark.id}
                            title={`${mark.here ? "Here" : "Away"} · ${mark.label}`}
                            className={cn(
                              "h-4.5 flex-1 rounded",
                              mark.here ? "bg-present" : "border-[1.5px] border-foreground/25 bg-card",
                            )}
                          />
                        ))}
                      </span>
                      <span className="w-9 text-right font-mono text-sm text-muted-foreground">
                        {here}/{marks.length}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-3.5 rounded bg-present" aria-hidden />
                  Here
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3.5 rounded border-[1.5px] border-foreground/25" aria-hidden />
                  Away
                </span>
              </div>
            </section>
          ) : null}

          {latestMedia.length > 0 ? (
            <section
              aria-labelledby="photos-heading"
              className="flex flex-col gap-3 rounded-3xl bg-card p-5 ring-1 ring-line"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 id="photos-heading" className="text-xl font-semibold">
                  Latest photos
                </h2>
                <Link href="/gallery" className="text-base font-semibold text-primary hover:underline">
                  All {mediaCount}
                </Link>
              </div>
              <ul className="grid grid-cols-3 gap-1.5">
                {latestMedia.map((item) => (
                  <li key={item.id}>
                    <MediaThumb
                      id={item.id}
                      contentType={item.contentType}
                      caption={item.caption}
                      className="aspect-square rounded-lg"
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
