import Link from "next/link";

import { NOTEBOOK_SECTION_LABELS } from "@/lib/notebook";
import {
  formatMeetingWhen,
  formatTeamDay,
  formatTeamStamp,
  TEAM_TIME_ZONE_ABBR,
} from "@/lib/timezone";

type NoteItem = {
  id: string;
  body: string;
  createdAt: Date;
  authorName: string;
};

type MediaItem = {
  id: string;
  contentType: string;
  caption: string | null;
  createdAt: Date;
  uploaderName: string;
};

type Attendee = {
  id: string;
  name: string;
  role: string;
};

export type JournalSessionCardProps = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  title: string | null;
  summary: string | null;
  sessionNumber: number | null;
  attendees: Attendee[];
  progress: NoteItem[];
  actions: NoteItem[];
  lessons: NoteItem[];
  media: MediaItem[];
};

function stamp(value: Date) {
  return `${formatTeamStamp(value)} ${TEAM_TIME_ZONE_ABBR}`;
}

function isImage(contentType: string) {
  return contentType.startsWith("image/");
}

function isVideo(contentType: string) {
  return contentType.startsWith("video/");
}

function NoteList({
  label,
  items,
}: {
  label: string;
  items: NoteItem[];
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-lg font-semibold">{label}</h3>
      <ol className="flex list-decimal flex-col gap-2 pl-6 text-lg marker:font-semibold">
        {items.map((item) => (
          <li key={item.id} className="pl-1">
            <p className="whitespace-pre-wrap">{item.body}</p>
            <p className="mt-1 text-base text-muted-foreground">
              — {item.authorName} · {stamp(item.createdAt)}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function JournalSessionCard(session: JournalSessionCardProps) {
  const heading =
    session.sessionNumber != null
      ? `Session ${session.sessionNumber}`
      : session.title?.trim() || "Session";

  return (
    <article className="rounded-xl bg-card px-4 py-5 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xl font-semibold">{heading}</h3>
        <span className="text-muted-foreground">{formatTeamDay(session.startsAt)}</span>
      </div>
      <p className="mt-1 text-base text-muted-foreground">
        {formatMeetingWhen(session.startsAt, session.endsAt)}
      </p>
      {session.title?.trim() && session.sessionNumber != null ? (
        <p className="mt-1 text-base text-muted-foreground">{session.title.trim()}</p>
      ) : null}

      {session.attendees.length > 0 ? (
        <p className="mt-3 text-base">
          <span className="font-medium">Who was here: </span>
          <span className="text-muted-foreground">
            {session.attendees.map((person) => person.name).join(", ")}
          </span>
        </p>
      ) : null}

      {session.summary?.trim() ? (
        <p className="mt-3 whitespace-pre-wrap text-lg">{session.summary.trim()}</p>
      ) : null}

      <div className="mt-4 flex flex-col gap-4">
        <NoteList label={NOTEBOOK_SECTION_LABELS.progress} items={session.progress} />
        <NoteList label={NOTEBOOK_SECTION_LABELS.action} items={session.actions} />
        <NoteList label={NOTEBOOK_SECTION_LABELS.lesson} items={session.lessons} />
      </div>

      {session.media.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2">
          <h3 className="text-lg font-semibold">Photos &amp; videos</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {session.media.map((item) => (
              <li key={item.id} className="flex flex-col gap-1">
                <div className="overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
                  {isImage(item.contentType) ? (
                    // Auth-gated app route; not a public CDN URL.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/media/${item.id}`}
                      alt={item.caption?.trim() || "Session photo"}
                      className="max-h-56 w-full object-contain bg-black/5"
                    />
                  ) : isVideo(item.contentType) ? (
                    <video
                      src={`/media/${item.id}`}
                      controls
                      preload="metadata"
                      className="max-h-56 w-full bg-black"
                    />
                  ) : (
                    <a
                      href={`/media/${item.id}`}
                      className="block px-4 py-6 text-center text-base underline-offset-4 hover:underline"
                    >
                      Open file
                    </a>
                  )}
                </div>
                {item.caption?.trim() ? (
                  <p className="text-base whitespace-pre-wrap">{item.caption}</p>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  — {item.uploaderName} · {stamp(item.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {session.attendees.length === 0 &&
      !session.summary?.trim() &&
      session.progress.length === 0 &&
      session.actions.length === 0 &&
      session.lessons.length === 0 &&
      session.media.length === 0 ? (
        <p className="mt-3 text-base text-muted-foreground">
          This session is in the notebook, but there is nothing to read here yet.
        </p>
      ) : null}

      <p className="mt-4">
        <Link
          href={`/meetings/${session.id}`}
          className="text-base font-medium underline-offset-4 hover:underline"
        >
          Open session to edit →
        </Link>
      </p>
    </article>
  );
}
