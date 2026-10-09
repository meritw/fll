import Link from "next/link";
import { Bot, Star } from "lucide-react";
import { cn } from "cn";

import { MediaThumb } from "@/components/journal/media-thumb";
import { StatusPill } from "@/components/journal/status-pill";
import { entryHeadline, type JournalEntryItem } from "@/lib/journal";
import { sessionHeadline, sessionLabel, type SessionRecord } from "@/lib/meetings";
import { missionCode } from "@/lib/mission-status";
import { TEAM_TIME_ZONE } from "@/lib/timezone";

const dayParts = new Intl.DateTimeFormat("en-US", {
  timeZone: TEAM_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TEAM_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

function partsOf(value: Date) {
  const map: Record<string, string> = {};
  for (const part of dayParts.formatToParts(value)) {
    map[part.type] = part.value;
  }
  return map;
}

export function formatTime(value: Date) {
  return timeFormat.format(value);
}

/** The date rail on the left of each timeline item. */
export function DateRail({ date, last }: { date: Date; last?: boolean }) {
  const parts = partsOf(date);
  return (
    <div className="flex w-10 shrink-0 flex-col items-center text-center sm:w-16">
      <span className="font-mono text-[11px] text-muted-foreground uppercase sm:text-[13px]">
        {parts.weekday}
      </span>
      <span className="text-2xl leading-none font-bold sm:text-3xl">{parts.day}</span>
      <span className="font-mono text-[11px] text-muted-foreground uppercase sm:text-[13px]">
        {parts.month}
      </span>
      {last ? null : <span aria-hidden className="mt-2.5 w-0.5 flex-1 bg-line" />}
    </div>
  );
}

export function TimelineRow({
  date,
  last,
  children,
}: {
  date: Date;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 pb-7 [content-visibility:auto] [contain-intrinsic-size:auto_280px] sm:gap-4">
      <DateRail date={date} last={last} />
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center self-start rounded-full px-2.5 text-sm font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}

function NoteColumn({
  heading,
  headingClass,
  items,
}: {
  heading: string;
  headingClass?: string;
  items: { id: string; body: string; authorName: string }[];
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2">
      <h4 className={cn("text-base font-semibold", headingClass)}>{heading}</h4>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-0.5">
            <p className="whitespace-pre-wrap">{item.body}</p>
            <span className="text-sm text-muted-foreground">{item.authorName}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function sessionCounts(record: SessionRecord) {
  const notes =
    record.progress.length +
    record.actions.length +
    record.lessons.length +
    record.otherNotes.length +
    record.missionNotes.length;
  return { notes, media: record.media.length };
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Full record of one meeting. `mediaLimit` shows a "+N more" tile after that many. */
export function SessionCard({
  record,
  students,
  mediaLimit,
  showAddLink = true,
}: {
  record: SessionRecord;
  students: { id: string; name: string }[];
  mediaLimit?: number;
  showAddLink?: boolean;
}) {
  const presentIds = new Set(record.attendees.map((person) => person.id));
  const away = students.filter((person) => !presentIds.has(person.id));
  const media = mediaLimit != null ? record.media.slice(0, mediaLimit) : record.media;
  const moreMedia = record.media.length - media.length;
  const uploaders = [...new Set(record.media.map((item) => item.uploaderName))];
  const counts = sessionCounts(record);
  const empty =
    record.attendees.length === 0 &&
    counts.notes === 0 &&
    counts.media === 0 &&
    record.robot.length === 0;

  return (
    <article className="flex flex-col gap-4 rounded-3xl bg-card p-4 ring-1 ring-line sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Pill className="bg-brand-tint text-brand-dark">Meeting · {sessionLabel(record)}</Pill>
          <h3 className="mt-1 text-xl leading-snug font-bold sm:text-2xl">
            {sessionHeadline(record)}
          </h3>
          <span className="text-base text-muted-foreground">
            Started {formatTime(record.startsAt)}
          </span>
        </div>
        {showAddLink ? (
          <Link
            href={`/journal/${record.id}`}
            className="inline-flex min-h-11 items-center rounded-xl bg-muted px-4 text-base font-medium hover:bg-foreground/10"
          >
            Add to this day
          </Link>
        ) : null}
      </div>

      {empty ? (
        <p className="text-muted-foreground">
          Nothing here yet. Tap your name in attendance, then add notes and photos.
        </p>
      ) : null}

      {record.attendees.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h4 className="text-base font-semibold">
            Who was here · {record.attendees.length} of {students.length || record.attendees.length}
          </h4>
          <ul className="flex flex-wrap gap-1.5">
            {record.attendees.map((person) => (
              <li
                key={person.id}
                className="inline-flex min-h-8 items-center rounded-full bg-present-tint px-3 text-base text-present-ink"
              >
                {person.name}
              </li>
            ))}
            {away.map((person) => (
              <li
                key={person.id}
                className="inline-flex min-h-8 items-center rounded-full border border-dashed border-foreground/25 px-3 text-base text-muted-foreground"
              >
                {person.name} · away
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {counts.notes - record.missionNotes.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          <NoteColumn heading="Today's progress" headingClass="text-primary" items={record.progress} />
          <NoteColumn heading="Lessons learned" headingClass="text-info" items={record.lessons} />
          <NoteColumn heading="Next time" items={record.actions} />
          <NoteColumn
            heading="Other notes"
            items={record.otherNotes.map((item) => ({
              id: item.id,
              body: item.title ? `${item.title}\n${item.body}` : item.body,
              authorName: item.authorName,
            }))}
          />
        </div>
      ) : null}

      {record.robot.length > 0 || record.missionNotes.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl bg-paper px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Bot className="size-5" aria-hidden />
            <span className="font-semibold">Robot update</span>
            {record.robot.map((item) => (
              <span key={item.missionId} className="inline-flex items-center gap-1.5">
                <span className="font-mono text-sm text-muted-foreground">
                  {missionCode(item.missionNumber)}
                </span>
                <StatusPill status={item.status} />
              </span>
            ))}
          </div>
          {record.missionNotes.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {record.missionNotes.map((note) => (
                <li key={note.id} className="text-base">
                  <span className="font-semibold">
                    {missionCode(note.missionNumber)} {note.missionName}:
                  </span>{" "}
                  <span className="whitespace-pre-wrap">{note.body}</span>{" "}
                  <span className="text-muted-foreground">({note.authorName})</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {record.media.length > 0 ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
          {media.map((item) => (
            <li key={item.id} className="flex flex-col gap-1">
              <MediaThumb
                id={item.id}
                contentType={item.contentType}
                caption={item.caption}
                className="aspect-[4/3]"
              />
              {mediaLimit == null && item.caption?.trim() ? (
                <span className="text-sm">{item.caption}</span>
              ) : null}
            </li>
          ))}
          {moreMedia > 0 ? (
            <li>
              <Link
                href={`/journal/${record.id}#photos`}
                className="flex aspect-[4/3] items-center justify-center rounded-xl bg-muted text-base font-semibold ring-1 ring-line hover:bg-foreground/10"
              >
                +{moreMedia} more
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}

      {uploaders.length > 0 || counts.notes > 0 ? (
        <p className="text-sm text-muted-foreground">
          {[
            uploaders.length > 0 ? `Photos by ${uploaders.join(", ")}` : null,
            counts.notes > 0 ? plural(counts.notes, "note") : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
    </article>
  );
}

/** One-card summary of an older meeting; the whole card opens the day. */
export function SessionSummaryCard({
  record,
  studentCount,
  /** Prefer explicit counts so the parent can omit heavy media/note arrays from the RSC payload. */
  mediaCount,
  noteCount,
}: {
  record: SessionRecord;
  studentCount: number;
  mediaCount?: number;
  noteCount?: number;
}) {
  const counts = sessionCounts(record);
  const notes = noteCount ?? counts.notes;
  const media = mediaCount ?? counts.media;
  const summary =
    record.progress[0]?.body ?? record.lessons[0]?.body ?? record.otherNotes[0]?.body ?? null;
  const facts = [
    record.attendees.length > 0
      ? `${record.attendees.length} of ${studentCount || record.attendees.length} here`
      : null,
    notes > 0 ? plural(notes, "note") : null,
    media > 0 ? plural(media, "photo") : null,
    record.robot.length > 0 ? plural(record.robot.length, "robot update") : null,
  ].filter(Boolean);
  const headline = sessionHeadline(record);
  return (
    <Link
      href={`/journal/${record.id}`}
      className="flex flex-col gap-2 rounded-3xl bg-card px-4 py-4 ring-1 ring-line hover:bg-muted/40 sm:px-5"
    >
      <span className="flex flex-wrap items-center gap-2">
        <Pill className="bg-brand-tint text-brand-dark">Meeting · {sessionLabel(record)}</Pill>
        {facts.length > 0 ? (
          <span className="text-base text-muted-foreground">{facts.join(" · ")}</span>
        ) : null}
      </span>
      <span className="text-lg leading-snug font-semibold sm:text-xl">{headline}</span>
      {summary && summary.split("\n")[0] !== headline ? (
        <span className="line-clamp-2 text-foreground/80">{summary}</span>
      ) : null}
      <span className="text-base font-semibold text-primary">Read the whole day</span>
    </Link>
  );
}

export function MilestoneCard({
  entry,
}: {
  entry: Pick<JournalEntryItem, "title" | "body" | "relatedMeeting" | "authorName">;
}) {
  const headline = entryHeadline(entry);
  const rest = entry.title?.trim()
    ? entry.body.trim()
    : entry.body.trim().split("\n").slice(1).join("\n").trim();
  return (
    <article className="flex items-start gap-4 rounded-3xl bg-milestone p-5 text-white">
      <Star className="size-9 shrink-0 text-milestone-accent" strokeWidth={1.8} aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-mono text-sm tracking-[0.08em] text-milestone-accent">
          MILESTONE
          {entry.relatedMeeting?.sessionNumber != null
            ? ` · SESSION ${entry.relatedMeeting.sessionNumber}`
            : ""}
        </span>
        <h3 className="text-xl leading-snug font-bold sm:text-2xl">{headline}</h3>
        {rest ? <p className="whitespace-pre-wrap text-milestone-soft">{rest}</p> : null}
        <span className="text-sm text-milestone-soft">{entry.authorName}</span>
        {entry.relatedMeeting ? (
          <Link
            href={`/journal/${entry.relatedMeeting.id}`}
            className="mt-1 self-start font-semibold text-white underline underline-offset-4"
          >
            See the whole day
          </Link>
        ) : null}
      </div>
    </article>
  );
}

/** A note not tied to a meeting: written from home, or saved without picking a meeting. */
export function LooseNoteCard({ entry }: { entry: JournalEntryItem }) {
  return (
    <article className="flex flex-col gap-2 rounded-3xl bg-card p-4 ring-1 ring-line sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Pill className="bg-info-tint text-info-ink">
          {entry.fromHome ? "Note from home" : "Note"}
        </Pill>
        <span className="text-base text-muted-foreground">
          {entry.authorName} · {formatTime(entry.createdAt)}
        </span>
      </div>
      {entry.title ? <h3 className="text-xl font-semibold">{entry.title}</h3> : null}
      <p className="text-lg whitespace-pre-wrap">{entry.body}</p>
    </article>
  );
}
