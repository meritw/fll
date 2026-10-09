import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JournalDayEditor } from "@/components/journal-day-editor";
import { MeetingCardExpanded } from "@/components/journal-meeting-card";
import { MeetingDetailsForm } from "@/components/meeting-details-form";
import { loadEditorContext, meetingHeading } from "@/lib/journal-editor";
import { resolveInitialTab } from "@/lib/journal-tabs";
import { getMeeting } from "@/lib/meetings";
import { isCoach, isParent } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import { teamDateKey } from "@/lib/timezone";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const meeting = await getMeeting(id);
  return {
    title: meeting?.sessionNumber != null ? `Session ${meeting.sessionNumber}` : "Journal day",
  };
}

export default async function JournalDayPage({ params, searchParams }: PageProps) {
  const session = await requireUser();
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const meeting = await getMeeting(id);
  if (!meeting) {
    notFound();
  }

  const parent = isParent(session.user.role);
  const context = await loadEditorContext(session.user.id);
  const isToday = teamDateKey(meeting.startsAt) === teamDateKey(context.now);

  return (
    <div className="flex flex-col gap-8">
      <JournalDayEditor
        key={meeting.id}
        meeting={{
          id: meeting.id,
          attendeeIds: meeting.attendees.map((person) => person.id),
          media: meeting.media.map((item) => ({
            id: item.id,
            contentType: item.contentType,
            caption: item.caption,
            uploaderName: item.uploaderName,
            uploaderId: item.uploaderId,
          })),
        }}
        heading={meetingHeading(meeting.startsAt, meeting.sessionNumber)}
        isToday={isToday}
        students={context.students}
        missions={context.missions}
        assignedMissionIds={context.assignedMissionIds}
        recentMeetings={context.recentMeetings}
        todayMeetingId={context.todayMeetingId}
        user={{ id: session.user.id, name: session.user.name, role: session.user.role }}
        initialTab={resolveInitialTab(tab, { isToday, parent })}
      />

      <section aria-labelledby="record-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="record-heading" className="text-2xl font-bold">
            The whole day
          </h2>
          <Link href="/journal" className="font-semibold text-primary underline-offset-4 hover:underline">
            Back to the journal
          </Link>
        </div>
        <MeetingCardExpanded
          meeting={meeting}
          students={context.students}
          mediaLimit={Number.POSITIVE_INFINITY}
          showAddLink={false}
        />
        {isCoach(session.user.role) ? (
          <details className="rounded-2xl border border-line bg-card px-5 py-2">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
              Coach: edit title or session number
            </summary>
            <div className="pt-2 pb-3">
              <MeetingDetailsForm
                meetingId={meeting.id}
                title={meeting.title}
                sessionNumber={meeting.sessionNumber}
              />
            </div>
          </details>
        ) : null}
      </section>
    </div>
  );
}
