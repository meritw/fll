import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AttendanceForm,
  MeetingDetailsForm,
  NotebookSection,
} from "@/components/meeting-forms";
import { MeetingMediaSection } from "@/components/meeting-media";
import { Separator } from "@/components/ui/separator";
import { listPeople } from "@/lib/accounts";
import { listMeetingMedia } from "@/lib/media";
import { getMeeting } from "@/lib/meetings";
import { requireUser } from "@/lib/session";
import {
  formatMeetingWhen,
  formatTeamDay,
  formatTeamStamp,
  TEAM_TIME_ZONE_ABBR,
} from "@/lib/timezone";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const meeting = await getMeeting(id);
  if (!meeting) {
    return { title: "Session" };
  }
  const session =
    meeting.sessionNumber != null ? `Session ${meeting.sessionNumber}` : "Session";
  return { title: session };
}

export default async function MeetingDetailPage({ params }: PageProps) {
  await requireUser();
  const { id } = await params;
  const [meeting, people, media] = await Promise.all([
    getMeeting(id),
    listPeople(),
    listMeetingMedia(id),
  ]);
  if (!meeting) {
    notFound();
  }

  const selectedIds = meeting.attendees.map((person) => person.id);
  const stamp = (value: Date) => `${formatTeamStamp(value)} ${TEAM_TIME_ZONE_ABBR}`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/meetings" className="text-base font-medium underline-offset-4 hover:underline">
          ← All meetings
        </Link>
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Engineering notebook
        </p>
        <h1 className="text-3xl font-semibold">
          {meeting.sessionNumber != null
            ? `Session ${meeting.sessionNumber}`
            : meeting.title?.trim() || "Team session"}
        </h1>
        <p className="text-xl">
          <span className="font-medium">Date:</span> {formatTeamDay(meeting.startsAt)}
        </p>
        <p className="text-lg text-muted-foreground">
          {formatMeetingWhen(meeting.startsAt, meeting.endsAt)}
        </p>
      </div>

      <div className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
        <MeetingDetailsForm
          meetingId={meeting.id}
          title={meeting.title}
          sessionNumber={meeting.sessionNumber}
        />
      </div>

      <Separator />

      <section className="flex flex-col gap-3">
        {meeting.attendanceRecordedAt && meeting.attendanceRecordedBy ? (
          <p className="text-muted-foreground">
            Attendance last saved by {meeting.attendanceRecordedBy.name} on{" "}
            {stamp(meeting.attendanceRecordedAt)}.
          </p>
        ) : null}
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

      <NotebookSection
        meetingId={meeting.id}
        kind="progress"
        items={meeting.progress.map((item) => ({
          id: item.id,
          body: item.body,
          authorName: item.authorName,
          createdLabel: stamp(item.createdAt),
        }))}
      />

      <Separator />

      <NotebookSection
        meetingId={meeting.id}
        kind="action"
        items={meeting.actions.map((item) => ({
          id: item.id,
          body: item.body,
          authorName: item.authorName,
          createdLabel: stamp(item.createdAt),
        }))}
      />

      <Separator />

      <NotebookSection
        meetingId={meeting.id}
        kind="lesson"
        items={meeting.lessons.map((item) => ({
          id: item.id,
          body: item.body,
          authorName: item.authorName,
          createdLabel: stamp(item.createdAt),
        }))}
      />

      <Separator />

      <MeetingMediaSection
        meetingId={meeting.id}
        items={media.map((item) => ({
          id: item.id,
          contentType: item.contentType,
          caption: item.caption,
          uploaderName: item.uploaderName,
          createdLabel: stamp(item.createdAt),
        }))}
      />
    </div>
  );
}
