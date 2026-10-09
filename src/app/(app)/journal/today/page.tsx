import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { JournalDayEditor } from "@/components/journal-day-editor";
import { meetingHeading, loadEditorContext } from "@/lib/journal-editor";
import { resolveInitialTab } from "@/lib/journal-tabs";
import { isParent } from "@/lib/roles";
import { findMeetingForDay } from "@/lib/meetings";
import { requireUser } from "@/lib/session";
import { teamDateKey } from "@/lib/timezone";

export const metadata: Metadata = {
  title: "Add to the journal",
};

type PageProps = {
  searchParams: Promise<{ tab?: string | string[] }>;
};

export default async function JournalTodayPage({ searchParams }: PageProps) {
  const session = await requireUser();
  const { tab } = await searchParams;
  const rawTab = Array.isArray(tab) ? tab[0] : tab;

  const today = await findMeetingForDay(teamDateKey(new Date()));
  if (today) {
    redirect(`/journal/${today.id}${rawTab ? `?tab=${encodeURIComponent(rawTab)}` : ""}`);
  }

  const parent = isParent(session.user.role);
  const context = await loadEditorContext(session.user.id);

  return (
    <JournalDayEditor
      meeting={null}
      heading={meetingHeading(context.now, context.nextSession)}
      isToday
      students={context.students}
      missions={context.missions}
      assignedMissionIds={context.assignedMissionIds}
      recentMeetings={context.recentMeetings}
      todayMeetingId={null}
      user={{ id: session.user.id, name: session.user.name, role: session.user.role }}
      initialTab={resolveInitialTab(tab, { isToday: true, parent })}
    />
  );
}
