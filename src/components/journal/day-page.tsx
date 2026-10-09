import Link from "next/link";
import { notFound } from "next/navigation";
import { X } from "lucide-react";

import { DayPicker } from "@/components/journal/day-picker";
import { DayTabs, type DayTab, type Viewer } from "@/components/journal/day-tabs";
import { StartPastMeetingForm } from "@/components/journal/start-past-meeting-form";
import { SessionCard } from "@/components/journal/timeline";
import { listStudents } from "@/lib/accounts";
import {
  getSessionRecord,
  listSessionRecords,
  nextSessionNumber,
  sessionLabel,
  todayKey,
} from "@/lib/meetings";
import { listMissionBoard } from "@/lib/missions-board";
import { isCoach, isParent, isStudent } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import { formatTeamDay } from "@/lib/timezone";

const TABS: DayTab[] = ["attend", "note", "media", "robot"];

/**
 * The "add to the journal" screen for one meeting, with that day's full record
 * below. `meetingId: null` is today before anyone has started the meeting.
 */
export async function DayPage({
  meetingId,
  tab,
}: {
  meetingId: string | null;
  tab: string | undefined;
}) {
  const session = await requireUser();
  const role = session.user.role;
  const viewer: Viewer = {
    id: session.user.id,
    name: session.user.name,
    role: isCoach(role) ? "coach" : isStudent(role) ? "student" : isParent(role) ? "parent" : "other",
  };

  const today = todayKey();
  const [record, students, board, recent, upcomingNumber] = await Promise.all([
    meetingId ? getSessionRecord(meetingId) : Promise.resolve(null),
    listStudents(),
    listMissionBoard(),
    listSessionRecords(30),
    nextSessionNumber(),
  ]);
  if (meetingId && !record) {
    notFound();
  }

  const writer = viewer.role === "student" || viewer.role === "coach";
  const isToday = record ? record.dayKey === today : true;
  const heading = record
    ? `${formatTeamDay(record.startsAt)} · ${sessionLabel(record)}`
    : `Today · Session ${upcomingNumber}`;
  const presentIds = new Set(record?.attendees.map((person) => person.id) ?? []);
  const requested = TABS.find((key) => key === tab);
  const initialTab: DayTab = requested ?? (isToday ? "attend" : "note");

  const dayOptions = [
    ...(record && isToday ? [] : [{ value: "today", label: "Today" }]),
    ...recent.map((item) => ({
      value: item.id,
      label: `${formatTeamDay(item.startsAt)} · ${sessionLabel(item)}`,
    })),
  ];
  if (record && !dayOptions.some((option) => option.value === record.id)) {
    dayOptions.unshift({ value: record.id, label: heading });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-sm tracking-[0.08em] text-primary">ADDING TO</span>
          <h1 className="text-2xl leading-tight font-bold sm:text-3xl">{heading}</h1>
          {!record ? (
            <p className="text-base text-muted-foreground">
              The meeting starts when the first person taps their name.
            </p>
          ) : null}
          <DayPicker current={record?.id ?? "today"} options={dayOptions} />
        </div>
        <Link
          href="/journal"
          aria-label="Close and go back to the journal"
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted hover:bg-foreground/10"
        >
          <X className="size-5" aria-hidden />
        </Link>
      </div>

      {writer ? (
        <StartPastMeetingForm todayKey={today} defaultSessionNumber={upcomingNumber} />
      ) : null}

      <DayTabs
        meetingId={record?.id ?? null}
        isToday={isToday}
        viewer={viewer}
        initialTab={initialTab}
        students={students.map((person) => ({
          id: person.id,
          name: person.name,
          present: presentIds.has(person.id),
        }))}
        missions={board.map((item) => ({
          id: item.id,
          number: item.number,
          name: item.name,
          status: item.status,
          mine: item.assignees.some((person) => person.id === viewer.id),
        }))}
        media={(record?.media ?? []).map((item) => ({
          id: item.id,
          contentType: item.contentType,
          caption: item.caption,
          uploaderId: item.uploaderId,
          uploaderName: item.uploaderName,
        }))}
      />

      {record ? (
        <section aria-labelledby="day-record" className="flex flex-col gap-3">
          <h2 id="day-record" className="text-xl font-semibold">
            Everything from this day
          </h2>
          <SessionCard record={record} students={students} showAddLink={false} />
        </section>
      ) : null}
    </div>
  );
}
