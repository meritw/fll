import { Bot, Camera, CircleCheck, Pencil, Play, Star } from "lucide-react";
import Link from "next/link";

import { JumpToMonth, SeasonEventForm, SeasonEventRemove } from "@/components/journal-client";
import {
  MeetingCardCompact,
  MeetingCardExpanded,
  type MeetingRecord,
} from "@/components/journal-meeting-card";
import {
  countStatuses,
  MissionStatusBar,
  MissionStatusLegend,
} from "@/components/mission-status-bar";
import { StatusPill } from "@/components/status-pill";
import { startTodayMeeting } from "@/lib/actions";
import {
  dayParts,
  monthKey,
  monthLabel,
  sessionLabel,
  timeOfDay,
  truncate,
} from "@/lib/journal-format";
import type { listJournalEntries, listSeasonEvents } from "@/lib/journal";
import type { listGalleryMedia } from "@/lib/media";
import type { listNotebookSessions } from "@/lib/meetings";
import { isWorking, missionCode, type MissionStatus } from "@/lib/mission-status";
import { isImageType, isVideoType } from "@/lib/media-types";
import { parseTeamDateKey, teamDateKey } from "@/lib/timezone";
import { cn } from "@/lib/utils";

export type Session = Awaited<ReturnType<typeof listNotebookSessions>>[number];
export type Entry = Awaited<ReturnType<typeof listJournalEntries>>[number];
export type SeasonEvent = Awaited<ReturnType<typeof listSeasonEvents>>[number];
export type GalleryMedia = Awaited<ReturnType<typeof listGalleryMedia>>[number];
export type BoardItem = {
  id: number;
  number: number;
  name: string;
  status: MissionStatus;
};
export type Student = { id: string; name: string };

export const JOURNAL_FILTERS = [
  { key: "all", label: "Everything" },
  { key: "meetings", label: "Meetings" },
  { key: "notes", label: "Notes" },
  { key: "photos", label: "Photos & video" },
  { key: "robot", label: "Robot updates" },
  { key: "milestones", label: "Milestones" },
] as const;
export type JournalFilter = (typeof JOURNAL_FILTERS)[number]["key"];

const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function keyLabel(dayKey: string) {
  const parsed = parseTeamDateKey(dayKey);
  return parsed ? `${MONTH_NAMES[parsed.month - 1]} ${parsed.day}` : dayKey;
}

type SeasonPoint = {
  id: string;
  kind: "milestone" | "event" | "here";
  dayKey: string;
  label: string;
  past: boolean;
};

function buildSeasonPoints(entries: Entry[], events: SeasonEvent[], todayKey: string) {
  const milestones: SeasonPoint[] = entries
    .filter((entry) => entry.milestone)
    .map((entry) => ({
      id: `m-${entry.id}`,
      kind: "milestone",
      dayKey: teamDateKey(entry.createdAt),
      label: truncate(entry.title?.trim() || entry.body.split("\n")[0], 24),
      past: true,
    }));
  const dated: SeasonPoint[] = events.map((event) => ({
    id: `e-${event.id}`,
    kind: "event",
    dayKey: event.dayKey,
    label: truncate(event.title, 24),
    past: event.dayKey <= todayKey,
  }));
  const all = [...milestones, ...dated].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const future = all.filter((point) => point.dayKey > todayKey).slice(0, 4);
  const past = all.filter((point) => point.dayKey <= todayKey).slice(-(7 - future.length));
  const here: SeasonPoint = {
    id: "here",
    kind: "here",
    dayKey: todayKey,
    label: "We are here",
    past: true,
  };
  return [...past, here, ...future];
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-primary-tint-soft px-4 py-3">
      <p className="text-3xl font-bold text-primary-dark">{value}</p>
      <p className="text-base text-ink-muted">{label}</p>
    </div>
  );
}

export function SeasonCard({
  entries,
  seasonEvents,
  board,
  sessionCount,
  robotUpdates,
  mediaCount,
  coach,
  now,
}: {
  entries: Entry[];
  seasonEvents: SeasonEvent[];
  board: BoardItem[];
  sessionCount: number;
  robotUpdates: number;
  mediaCount: number;
  coach: boolean;
  now: Date;
}) {
  const todayKey = teamDateKey(now);
  const points = buildSeasonPoints(entries, seasonEvents, todayKey);
  const hereIndex = points.findIndex((point) => point.kind === "here");
  const working = board.filter((item) => isWorking(item.status)).length;
  const span = Math.max(points.length - 1, 1);

  return (
    <section aria-labelledby="season-heading" className="flex flex-col gap-5 rounded-2xl border border-line bg-card p-5">
      <h2 id="season-heading" className="text-xl font-bold">
        Season so far
      </h2>

      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <ol className="relative flex min-w-max">
          {points.length > 1 ? (
            <div
              aria-hidden
              className="absolute top-[34px] h-0.5 bg-line"
              style={{ left: `${50 / points.length}%`, right: `${50 / points.length}%` }}
            >
              <div
                className="h-full bg-primary"
                style={{ width: `${(hereIndex / span) * 100}%` }}
              />
            </div>
          ) : null}
          {points.map((point) => (
            <li key={point.id} className="relative flex w-28 flex-col items-center gap-1.5 px-1 text-center">
              <span className="font-mono text-xs tracking-wider text-ink-muted uppercase">
                {keyLabel(point.dayKey)}
              </span>
              {point.kind === "here" ? (
                <span aria-hidden className="size-6 rounded-full border-[6px] border-primary bg-card" />
              ) : point.past ? (
                <span aria-hidden className="size-4 rounded-full bg-primary" />
              ) : (
                <span aria-hidden className="size-4 rounded-full border-2 border-dashed border-primary bg-card" />
              )}
              <span
                className={cn(
                  "text-sm leading-tight",
                  point.kind === "here" ? "font-bold text-primary" : "text-ink",
                )}
              >
                {point.label}
                {point.kind === "milestone" ? <span className="sr-only"> (milestone)</span> : null}
                {point.kind === "event" && !point.past ? <span className="sr-only"> (coming up)</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {coach ? (
        <div className="flex flex-col gap-3">
          <details className="rounded-xl border border-line px-4 py-2">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
              Add a season date
            </summary>
            <div className="pt-2 pb-3">
              <SeasonEventForm defaultDate={todayKey} />
            </div>
          </details>
          {seasonEvents.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {seasonEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center gap-1 rounded-full border border-line py-0.5 pr-0.5 pl-3 text-sm"
                >
                  <span className="font-mono text-ink-muted">{keyLabel(event.dayKey)}</span> {event.title}
                  <SeasonEventRemove id={event.id} title={event.title} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
        <Stat value={sessionCount} label={sessionCount === 1 ? "meeting" : "meetings"} />
        <div className="rounded-xl bg-primary-tint-soft px-4 py-3">
          <p className="text-3xl font-bold text-primary-dark">
            {working}
            <span className="text-xl font-semibold text-ink-muted"> of {board.length}</span>
          </p>
          <p className="text-base text-ink-muted">missions working</p>
        </div>
        <Stat value={robotUpdates} label="robot updates" />
        <Stat value={mediaCount} label="photos and videos" />
      </div>
    </section>
  );
}

export function AddToJournal({ parent }: { parent: boolean }) {
  const buttons = [
    {
      tab: "attend",
      icon: CircleCheck,
      title: "Who's here today",
      short: "I'm here",
      hint: "Tap your name when you arrive",
      primary: true,
      parentOk: false,
    },
    {
      tab: "note",
      icon: Pencil,
      title: "Write a note",
      short: "Note",
      hint: "What we did, learned, or need to do next",
      primary: false,
      parentOk: true,
    },
    {
      tab: "media",
      icon: Camera,
      title: "Add photos or video",
      short: "Add photo",
      hint: "Parents and coaches too",
      primary: false,
      parentOk: true,
    },
    {
      tab: "robot",
      icon: Bot,
      title: "Robot update",
      short: "Robot",
      hint: "Which missions worked today",
      primary: false,
      parentOk: false,
    },
  ].filter((button) => !parent || button.parentOk);

  return (
    <section aria-labelledby="add-heading" className="flex flex-col gap-3">
      <h2 id="add-heading" className="text-xl font-bold">
        Add to the journal
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        {buttons.map((button) => {
          const Icon = button.icon;
          return (
            <Link
              key={button.tab}
              href={`/journal/today?tab=${button.tab}`}
              className={cn(
                "flex min-h-24 flex-col justify-center gap-1 rounded-2xl border-2 px-4 py-3 transition-colors",
                button.primary
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border-line bg-card hover:border-primary",
              )}
            >
              <Icon className="size-6" aria-hidden />
              <span className="text-lg font-bold">
                <span className="sm:hidden">{button.short}</span>
                <span className="hidden sm:inline">{button.title}</span>
              </span>
              <span
                className={cn(
                  "hidden text-sm sm:block",
                  button.primary ? "text-primary-foreground/90" : "text-ink-muted",
                )}
              >
                {button.hint}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function TodayCard({
  nextSession,
  todayMeeting,
  parent,
}: {
  nextSession: number;
  todayMeeting: { id: string; sessionNumber: number | null } | null;
  parent: boolean;
}) {
  if (todayMeeting) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-present-bg px-5 py-4 text-present-text">
        <p className="font-semibold">
          Today&apos;s meeting is open · {sessionLabel(todayMeeting.sessionNumber)}
        </p>
        <Link
          href={`/journal/${todayMeeting.id}`}
          className="inline-flex min-h-11 items-center rounded-xl bg-present px-4 font-semibold text-white"
        >
          Add to today
        </Link>
      </div>
    );
  }
  if (parent) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-dashed border-primary/60 bg-primary-tint-soft px-5 py-4">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-mono text-sm font-semibold tracking-wider text-primary uppercase">
          Meeting today? · Start Session {nextSession}
        </p>
        <p className="text-base text-ink-muted">
          It also starts by itself when the first person taps their name in &lsquo;Who&apos;s here
          today&rsquo;.
        </p>
      </div>
      <form
        action={async () => {
          "use server";
          await startTodayMeeting();
        }}
      >
        <button
          type="submit"
          className="min-h-12 rounded-xl bg-primary px-5 text-lg font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Start meeting
        </button>
      </form>
    </div>
  );
}

type TimelineItem =
  | { key: string; at: Date; kind: "meeting"; session: Session }
  | { key: string; at: Date; kind: "milestone"; entry: Entry }
  | { key: string; at: Date; kind: "note"; entry: Entry };

export function buildTimeline(sessions: Session[], entries: Entry[], filter: JournalFilter) {
  const items: TimelineItem[] = [];
  for (const session of sessions) {
    const include =
      filter === "all" ||
      filter === "meetings" ||
      (filter === "photos" && session.media.length > 0) ||
      (filter === "robot" &&
        (session.missionStatusEvents.length > 0 || session.missionNotes.length > 0));
    if (include) {
      items.push({ key: `s-${session.id}`, at: session.startsAt, kind: "meeting", session });
    }
  }
  for (const entry of entries) {
    if (entry.milestone) {
      if (filter === "all" || filter === "milestones") {
        items.push({ key: `j-${entry.id}`, at: entry.createdAt, kind: "milestone", entry });
      }
    } else if (filter === "all" || filter === "notes") {
      items.push({ key: `j-${entry.id}`, at: entry.createdAt, kind: "note", entry });
    }
  }
  return items.sort((a, b) => b.at.getTime() - a.at.getTime());
}

export function FilterPills({ active }: { active: JournalFilter }) {
  return (
    <nav aria-label="Filter the timeline" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {JOURNAL_FILTERS.map((filter) => (
        <Link
          key={filter.key}
          href={filter.key === "all" ? "/journal" : `/journal?show=${filter.key}`}
          aria-pressed={active === filter.key}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 font-medium",
            active === filter.key
              ? "border-primary bg-primary text-primary-foreground"
              : "border-line bg-card hover:border-primary",
          )}
        >
          {filter.label}
        </Link>
      ))}
    </nav>
  );
}

function MilestoneCard({ entry }: { entry: Entry }) {
  const lines = entry.body.trim().split("\n");
  const headline = entry.title?.trim() || lines[0];
  const body = entry.title?.trim() ? entry.body.trim() : lines.slice(1).join("\n").trim();

  return (
    <article className="flex flex-col gap-2 rounded-2xl bg-primary-dark p-5 text-white">
      <p className="flex items-center gap-2 font-mono text-sm font-semibold tracking-wider uppercase">
        <Star className="size-4 fill-current" aria-hidden />
        Milestone
        {entry.relatedMeeting?.sessionNumber != null
          ? ` · Session ${entry.relatedMeeting.sessionNumber}`
          : ""}
      </p>
      <h3 className="text-2xl font-bold">{headline}</h3>
      {body ? <p className="whitespace-pre-wrap text-white/90">{body}</p> : null}
      <p className="text-sm text-white/75">
        {entry.authorName} · {timeOfDay(entry.createdAt)}
      </p>
    </article>
  );
}

function NoteCard({ entry }: { entry: Entry }) {
  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-info-bg px-3 py-0.5 text-sm font-semibold text-info-text">Note</span>
        {entry.relatedMeeting ? (
          <Link
            href={`/journal/${entry.relatedMeeting.id}`}
            className="text-sm text-ink-muted underline-offset-4 hover:underline"
          >
            {sessionLabel(entry.relatedMeeting.sessionNumber)}
          </Link>
        ) : null}
        <span className="text-sm text-ink-muted">
          {entry.authorName} · {timeOfDay(entry.createdAt)}
        </span>
      </div>
      {entry.title ? <h3 className="text-xl font-bold">{entry.title}</h3> : null}
      <p className="whitespace-pre-wrap">{entry.body}</p>
    </article>
  );
}

export function Timeline({
  items,
  students,
  expandedIds,
  filter,
}: {
  items: TimelineItem[];
  students: Student[];
  expandedIds: Set<string>;
  filter: JournalFilter;
}) {
  const months: { id: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = monthKey(item.at);
    if (!seen.has(key)) {
      seen.add(key);
      months.push({ id: `m-${key}`, label: monthLabel(item.at) });
    }
  }

  return (
    <section aria-labelledby="timeline-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="timeline-heading" className="text-2xl font-bold">
          Timeline
        </h2>
        <JumpToMonth months={months} />
      </div>
      <FilterPills active={filter} />

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-5 text-ink-muted">
          Nothing here yet. Tap <strong>Who&apos;s here today</strong> when your meeting starts.
        </p>
      ) : (
        <ol className="flex flex-col">
          {items.map((item, index) => {
            const key = monthKey(item.at);
            const newMonth = index === 0 || monthKey(items[index - 1].at) !== key;
            const parts = dayParts(item.at);
            return (
              <li key={item.key} className="flex flex-col">
                {newMonth ? (
                  <h3
                    id={`m-${key}`}
                    className="scroll-mt-4 pt-2 pb-3 font-mono text-sm font-semibold tracking-widest text-ink-muted uppercase"
                  >
                    {monthLabel(item.at)}
                  </h3>
                ) : null}
                <div className="flex gap-3 sm:gap-4">
                  <div className="flex w-10 shrink-0 flex-col items-center sm:w-16">
                    <span className="font-mono text-xs text-ink-muted">{parts.weekday}</span>
                    <span className="text-2xl leading-none font-bold sm:text-3xl">{parts.day}</span>
                    <span className="font-mono text-xs text-ink-muted">{parts.month}</span>
                    <span aria-hidden className="mt-2 w-0.5 flex-1 bg-line" />
                  </div>
                  <div className="min-w-0 flex-1 pb-6">
                    {item.kind === "meeting" ? (
                      expandedIds.has(item.session.id) ? (
                        <MeetingCardExpanded
                          meeting={item.session as MeetingRecord}
                          students={students}
                        />
                      ) : (
                        <MeetingCardCompact
                          meeting={item.session as MeetingRecord}
                          studentCount={students.length}
                        />
                      )
                    ) : item.kind === "milestone" ? (
                      <MilestoneCard entry={item.entry} />
                    ) : (
                      <NoteCard entry={item.entry} />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function Sidebar({
  board,
  students,
  sessions,
  latestMedia,
  mediaCount,
}: {
  board: BoardItem[];
  students: Student[];
  sessions: Session[];
  latestMedia: GalleryMedia[];
  mediaCount: number;
}) {
  const counts = countStatuses(board);
  const working = board.filter((item) => isWorking(item.status)).length;
  const lastEight = sessions.filter((session) => session.attendeeCount > 0).slice(0, 8).reverse();

  return (
    <aside className="flex flex-col gap-5">
      <section aria-labelledby="progress-heading" className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5">
        <h2 id="progress-heading" className="text-xl font-bold">
          Mission progress
        </h2>
        <p className="font-semibold">
          {working} of {board.length} working
        </p>
        <MissionStatusBar counts={counts} />
        <MissionStatusLegend counts={counts} />
        <ul className="flex flex-col gap-1">
          {board.map((item) => (
            <li key={item.id}>
              <Link
                href={`/missions?m=${item.number}`}
                className="flex min-h-11 items-center gap-2 rounded-lg px-1 hover:bg-primary-tint-soft"
              >
                <span className="font-mono text-sm font-semibold text-primary">{missionCode(item.number)}</span>
                <span className="min-w-0 flex-1 truncate text-base">{item.name}</span>
                <StatusPill status={item.status} className="text-xs" />
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/missions" className="font-semibold text-primary underline-offset-4 hover:underline">
          Open Missions to join one or add notes
        </Link>
      </section>

      <section aria-labelledby="attendance-heading" className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5">
        <h2 id="attendance-heading" className="text-xl font-bold">
          Attendance
        </h2>
        <p className="text-sm text-ink-muted">Last {lastEight.length || 8} meetings</p>
        {lastEight.length === 0 ? (
          <p className="text-base text-ink-muted">Attendance shows up after your first meeting.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {students.map((student) => {
              const hereCount = lastEight.filter((session) =>
                session.attendees.some((person) => person.id === student.id),
              ).length;
              return (
                <li key={student.id} className="flex items-center gap-2">
                  <span className="w-20 truncate text-base">{student.name}</span>
                  <span className="flex flex-1 gap-1">
                    {lastEight.map((session) => {
                      const here = session.attendees.some((person) => person.id === student.id);
                      return (
                        <span
                          key={session.id}
                          title={`${here ? "Here" : "Away"} · ${sessionLabel(session.sessionNumber)}`}
                          className={cn(
                            "size-4 rounded-[4px] border-2",
                            here ? "border-present bg-present" : "border-line bg-card",
                          )}
                        />
                      );
                    })}
                  </span>
                  <span className="font-mono text-sm text-ink-muted">
                    {hereCount}/{lastEight.length}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="flex flex-wrap gap-x-4 text-sm text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-[3px] bg-present" /> Here
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-[3px] border-2 border-line" /> Away
          </span>
        </p>
      </section>

      <section aria-labelledby="photos-heading" className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="photos-heading" className="text-xl font-bold">
            Latest photos
          </h2>
          <Link href="/gallery" className="font-semibold text-primary underline-offset-4 hover:underline">
            All {mediaCount}
          </Link>
        </div>
        {latestMedia.length === 0 ? (
          <p className="text-base text-ink-muted">No photos or videos yet.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {latestMedia.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/journal/${item.meetingId}`}
                  className="relative block aspect-square overflow-hidden rounded-lg bg-muted"
                >
                  {isImageType(item.contentType) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/media/${item.id}`}
                      alt={item.caption?.trim() || "Journal photo"}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center bg-black text-white">
                      <Play className="size-6" aria-hidden />
                      <span className="sr-only">
                        {isVideoType(item.contentType) ? "Video" : "File"}
                      </span>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
