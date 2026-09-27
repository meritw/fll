import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AttendanceForm,
  MeetingDetailsForm,
  MeetingNoteForm,
} from "@/components/meeting-forms";
import { Separator } from "@/components/ui/separator";
import { listPeople } from "@/lib/accounts";
import { getMeeting } from "@/lib/meetings";
import { requireUser } from "@/lib/session";
import { formatMeetingWhen, formatTeamStamp } from "@/lib/timezone";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const meeting = await getMeeting(id);
  return {
    title: meeting?.title?.trim() || "Meeting",
  };
}

export default async function MeetingDetailPage({ params }: PageProps) {
  await requireUser();
  const { id } = await params;
  const [meeting, people] = await Promise.all([getMeeting(id), listPeople()]);
  if (!meeting) {
    notFound();
  }

  const selectedIds = meeting.attendees.map((person) => person.id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/meetings" className="text-base font-medium underline-offset-4 hover:underline">
          ← All meetings
        </Link>
        <h1 className="text-3xl font-semibold">{meeting.title?.trim() || "Team meeting"}</h1>
        <p className="text-lg text-muted-foreground">
          {formatMeetingWhen(meeting.startsAt, meeting.endsAt)}
        </p>
        {meeting.summary ? <p className="text-lg">{meeting.summary}</p> : null}
      </div>

      <MeetingDetailsForm
        meetingId={meeting.id}
        title={meeting.title}
        summary={meeting.summary}
      />

      <Separator />

      <section className="flex flex-col gap-3">
        {meeting.attendanceRecordedAt && meeting.attendanceRecordedBy ? (
          <p className="text-muted-foreground">
            Attendance last saved by {meeting.attendanceRecordedBy.name} on{" "}
            {formatTeamStamp(meeting.attendanceRecordedAt)} PT.
          </p>
        ) : (
          <p className="text-muted-foreground">Attendance not recorded yet.</p>
        )}
        <AttendanceForm
          key={`${meeting.id}-${meeting.attendanceRecordedAt?.toISOString() ?? "none"}`}
          meetingId={meeting.id}
          people={people.map((person) => ({
            id: person.id,
            name: person.name,
            role: person.role,
          }))}
          selectedIds={selectedIds}
        />
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Notes</h2>
        {meeting.notes.length === 0 ? (
          <p className="text-muted-foreground">No notes yet. Add the first one below.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {meeting.notes.map((note) => (
              <li
                key={note.id}
                className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10"
              >
                <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-base text-muted-foreground">
                  <span className="font-medium text-foreground">{note.authorName}</span>
                  <span>{formatTeamStamp(note.createdAt)} PT</span>
                </div>
                <p className="whitespace-pre-wrap text-lg">{note.body}</p>
              </li>
            ))}
          </ol>
        )}
        <MeetingNoteForm meetingId={meeting.id} />
      </section>
    </div>
  );
}
