"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { cn } from "cn";

import { AttendanceTab } from "@/components/journal/attendance-tab";
import { NoteTab } from "@/components/journal/note-tab";
import { PhotosTab, type ExistingMedia } from "@/components/journal/photos-tab";
import { RobotTab, type RobotMission } from "@/components/journal/robot-tab";
import { ensureTodayMeetingId } from "@/lib/actions";

export type DayTab = "attend" | "note" | "media" | "robot";

const TAB_LABELS: Record<DayTab, string> = {
  attend: "Attendance",
  note: "Note",
  media: "Photos",
  robot: "Robot",
};

export type Viewer = {
  id: string;
  name: string;
  role: "student" | "coach" | "parent" | "other";
};

export function DayTabs({
  meetingId: initialMeetingId,
  isToday,
  viewer,
  initialTab,
  students,
  missions,
  media,
}: {
  /** null = today, and today's meeting hasn't started yet. */
  meetingId: string | null;
  isToday: boolean;
  viewer: Viewer;
  initialTab: DayTab;
  students: { id: string; name: string; present: boolean }[];
  missions: RobotMission[];
  media: ExistingMedia[];
}) {
  const router = useRouter();
  const writer = viewer.role === "student" || viewer.role === "coach";
  const tabs: DayTab[] = writer ? ["attend", "note", "media", "robot"] : ["media", "note"];
  const [tab, setTab] = useState<DayTab>(tabs.includes(initialTab) ? initialTab : tabs[0]);
  const [meetingId, setMeetingId] = useState(initialMeetingId);
  const pendingStart = useRef<Promise<string> | null>(null);

  /** The meeting to save into, starting today's meeting if needed. */
  const ensureMeeting = useCallback(async () => {
    if (meetingId) {
      return meetingId;
    }
    if (!pendingStart.current) {
      pendingStart.current = ensureTodayMeetingId().then((result) => {
        if ("error" in result) {
          pendingStart.current = null;
          throw new Error(result.error);
        }
        return result.id;
      });
    }
    const id = await pendingStart.current;
    setMeetingId(id);
    return id;
  }, [meetingId]);

  /** After any save: remember the meeting (it may have just started) and refresh the record. */
  const saved = useCallback(
    (id: string | undefined) => {
      if (id) {
        setMeetingId(id);
      }
      router.refresh();
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="What are you adding?"
        className={cn(
          "grid gap-2 rounded-2xl bg-muted p-1.5",
          tabs.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2",
        )}
      >
        {tabs.map((key) => {
          const on = key === tab;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={on}
              aria-controls={`panel-${key}`}
              onClick={() => setTab(key)}
              className={cn(
                "min-h-14 rounded-xl text-base font-semibold",
                on ? "bg-card text-primary shadow-sm" : "text-foreground/75 hover:bg-card/60",
              )}
            >
              {TAB_LABELS[key]}
            </button>
          );
        })}
      </div>

      {/* Every panel stays mounted so drafts and uploads survive switching tabs. */}
      {tabs.map((key) => (
        <div
          key={key}
          role="tabpanel"
          id={`panel-${key}`}
          aria-labelledby={`tab-${key}`}
          hidden={key !== tab}
        >
          {key === "attend" ? (
            <AttendanceTab
              meetingId={meetingId}
              isToday={isToday}
              students={students}
              onSaved={saved}
            />
          ) : null}
          {key === "note" ? (
            <NoteTab meetingId={meetingId} isToday={isToday} viewer={viewer} onSaved={saved} />
          ) : null}
          {key === "media" ? (
            <PhotosTab
              viewer={viewer}
              existing={media}
              isToday={isToday}
              ensureMeeting={ensureMeeting}
              onSaved={saved}
            />
          ) : null}
          {key === "robot" ? (
            <RobotTab
              meetingId={meetingId}
              missions={missions}
              ensureMeeting={ensureMeeting}
              onSaved={saved}
            />
          ) : null}
        </div>
      ))}

      {tab !== "note" ? (
        <Link
          href="/journal"
          className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-muted text-lg font-semibold hover:bg-foreground/10"
        >
          Back to the journal
        </Link>
      ) : null}
    </div>
  );
}
