import { CircleCheck, Plus } from "lucide-react";
import Link from "next/link";

import { MediaTile } from "@/components/media-tile";
import { StatusPill } from "@/components/status-pill";
import {
  meetingHeadline,
  plural,
  sessionLabel,
  timeOfDay,
  truncate,
} from "@/lib/journal-format";
import {
  MISSION_STATUS_LABELS,
  missionCode,
  type MissionStatus,
} from "@/lib/mission-status";
import { TEAM_TIME_ZONE_ABBR } from "@/lib/timezone";
import { cn } from "@/lib/utils";

type Note = { id: string; body: string; createdAt: Date; authorName: string };

export type MeetingRecord = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  title: string | null;
  summary: string | null;
  sessionNumber: number | null;
  attendees: { id: string; name: string }[];
  progress: Note[];
  actions: Note[];
  lessons: Note[];
  media: {
    id: string;
    contentType: string;
    caption: string | null;
    createdAt: Date;
    uploaderName: string;
  }[];
  missionNotes: {
    id: string;
    body: string;
    authorName: string;
    missionNumber: number;
    missionName: string;
  }[];
  missionStatusEvents: {
    id: string;
    status: MissionStatus;
    missionId: number;
    missionNumber: number;
    missionName: string;
  }[];
};

type Student = { id: string; name: string };

function noteCount(meeting: MeetingRecord) {
  return (
    meeting.progress.length +
    meeting.actions.length +
    meeting.lessons.length +
    meeting.missionNotes.length
  );
}

export function MeetingPill({ sessionNumber }: { sessionNumber: number | null }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary-tint px-3 py-0.5 text-sm font-semibold text-primary-dark">
      Meeting · {sessionLabel(sessionNumber)}
    </span>
  );
}

function NoteColumn({
  title,
  titleClass,
  notes,
  checklist,
}: {
  title: string;
  titleClass: string;
  notes: Note[];
  checklist?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h4 className={cn("font-mono text-sm font-semibold tracking-wider uppercase", titleClass)}>
        {title}
      </h4>
      {notes.length === 0 ? (
        <p className="text-base text-ink-muted">Nothing yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id} className="flex gap-2">
              {checklist ? (
                <span
                  aria-hidden
                  className="mt-1 size-5 shrink-0 rounded-md border-2 border-line bg-card"
                />
              ) : null}
              <div className="min-w-0">
                <p className="text-base whitespace-pre-wrap">{note.body}</p>
                <p className="text-sm text-ink-muted">{note.authorName}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function latestStatuses(events: MeetingRecord["missionStatusEvents"]) {
  const byMission = new Map<number, MeetingRecord["missionStatusEvents"][number]>();
  for (const event of events) {
    byMission.set(event.missionId, event);
  }
  return [...byMission.values()].sort((a, b) => a.missionNumber - b.missionNumber);
}

export function MeetingCardExpanded({
  meeting,
  students,
  mediaLimit = 3,
  showAddLink = true,
  className,
}: {
  meeting: MeetingRecord;
  students: Student[];
  mediaLimit?: number;
  showAddLink?: boolean;
  className?: string;
}) {
  const presentIds = new Set(meeting.attendees.map((person) => person.id));
  const away = students.filter((student) => !presentIds.has(student.id));
  const statuses = latestStatuses(meeting.missionStatusEvents);
  const shownMedia = meeting.media.slice(0, mediaLimit);
  const hiddenMedia = meeting.media.length - shownMedia.length;
  const uploaders = [...new Set(meeting.media.map((item) => item.uploaderName))];
  const hasNotebook =
    meeting.progress.length + meeting.actions.length + meeting.lessons.length > 0;

  return (
    <article className={cn("flex flex-col gap-5 rounded-2xl border border-line bg-card p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <MeetingPill sessionNumber={meeting.sessionNumber} />
          <h3 className="text-2xl font-bold">{meetingHeadline(meeting)}</h3>
          <p className="font-mono text-sm text-ink-muted">
            {timeOfDay(meeting.startsAt)}–{timeOfDay(meeting.endsAt)} {TEAM_TIME_ZONE_ABBR}
          </p>
        </div>
        {showAddLink ? (
          <Link
            href={`/journal/${meeting.id}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-5" aria-hidden />
            Add to this day
          </Link>
        ) : null}
      </div>

      {meeting.attendees.length > 0 ? (
        <section aria-label="Who was here" className="flex flex-col gap-2">
          <h4 className="font-mono text-sm font-semibold tracking-wider text-present-text uppercase">
            Who was here · {meeting.attendees.length} of {Math.max(students.length, meeting.attendees.length)}
          </h4>
          <ul className="flex flex-wrap gap-2">
            {meeting.attendees.map((person) => (
              <li
                key={person.id}
                className="rounded-full bg-present-bg px-3 py-1 text-base font-medium text-present-text"
              >
                {person.name}
              </li>
            ))}
            {away.map((person) => (
              <li
                key={person.id}
                className="rounded-full border border-dashed border-ink-muted/50 px-3 py-1 text-base text-ink-muted"
              >
                {person.name} · away
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {meeting.summary?.trim() ? (
        <p className="whitespace-pre-wrap">{meeting.summary.trim()}</p>
      ) : null}

      {hasNotebook ? (
        <div className="grid gap-5 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
          <NoteColumn title="Today’s progress" titleClass="text-primary" notes={meeting.progress} />
          <NoteColumn title="Lessons learned" titleClass="text-info" notes={meeting.lessons} />
          <NoteColumn
            title="Next time"
            titleClass="text-ink-muted"
            notes={meeting.actions}
            checklist
          />
        </div>
      ) : null}

      {statuses.length > 0 || meeting.missionNotes.length > 0 ? (
        <section aria-label="Robot updates" className="flex flex-col gap-2">
          <h4 className="font-mono text-sm font-semibold tracking-wider text-primary uppercase">
            Robot updates
          </h4>
          {statuses.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {statuses.map((event) => (
                <li key={event.missionId}>
                  <StatusPill status={event.status} className="py-1 text-base">
                    {missionCode(event.missionNumber)} · {MISSION_STATUS_LABELS[event.status]}
                  </StatusPill>
                </li>
              ))}
            </ul>
          ) : null}
          {meeting.missionNotes.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {meeting.missionNotes.map((note) => (
                <li key={note.id} className="text-base">
                  <span className="font-semibold">
                    {missionCode(note.missionNumber)} {note.missionName}:
                  </span>{" "}
                  {note.body}{" "}
                  <span className="text-ink-muted">({note.authorName})</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {shownMedia.length > 0 ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
          {shownMedia.map((item) => (
            <li key={item.id} className="flex min-w-0 flex-col gap-1">
              <MediaTile id={item.id} contentType={item.contentType} caption={item.caption} />
              {item.caption?.trim() ? (
                <p className="line-clamp-2 text-sm text-ink-muted">{item.caption}</p>
              ) : null}
            </li>
          ))}
          {hiddenMedia > 0 ? (
            <li>
              <Link
                href={`/journal/${meeting.id}`}
                className="flex aspect-[4/3] items-center justify-center rounded-xl bg-primary-tint text-lg font-semibold text-primary-dark"
              >
                +{hiddenMedia} more
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}

      <p className="text-sm text-ink-muted">
        {uploaders.length > 0 ? `Photos by ${uploaders.join(", ")} · ` : ""}
        {plural(noteCount(meeting), "note")}
      </p>
    </article>
  );
}

export function MeetingCardCompact({
  meeting,
  studentCount,
}: {
  meeting: MeetingRecord;
  studentCount: number;
}) {
  const summary = meeting.progress[0]?.body ?? meeting.summary ?? "";
  const headline = meetingHeadline(meeting);

  return (
    <Link
      href={`/journal/${meeting.id}`}
      className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-5 transition-colors hover:border-primary/60"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MeetingPill sessionNumber={meeting.sessionNumber} />
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <CircleCheck className="size-4 text-present" aria-hidden />
          {meeting.attendees.length} of {Math.max(studentCount, meeting.attendees.length)} here ·{" "}
          {plural(noteCount(meeting), "note")} · {plural(meeting.media.length, "photo")}
        </p>
      </div>
      <h3 className="text-xl font-bold">{headline}</h3>
      {summary.trim() && truncate(summary, 80) !== headline ? (
        <p className="line-clamp-2 text-base text-ink-muted">{truncate(summary, 200)}</p>
      ) : null}
      <span className="text-base font-semibold text-primary">Read the whole day →</span>
    </Link>
  );
}
