import { listStudents } from "@/lib/accounts";
import { longDay, sessionLabel, weekdayDate } from "@/lib/journal-format";
import {
  findMeetingForDay,
  listRecentMeetings,
  peekNextSessionNumber,
} from "@/lib/meetings";
import { listMissionBoard } from "@/lib/missions-board";
import { teamDateKey } from "@/lib/timezone";

/** Everything the Add screen needs besides the meeting itself. */
export async function loadEditorContext(viewerId: string) {
  const now = new Date();
  const [students, board, recent, todayMeeting, nextSession] = await Promise.all([
    listStudents(),
    listMissionBoard(),
    listRecentMeetings(20),
    findMeetingForDay(teamDateKey(now)),
    peekNextSessionNumber(),
  ]);

  return {
    now,
    nextSession,
    todayMeetingId: todayMeeting?.id ?? null,
    students: students.map((student) => ({ id: student.id, name: student.name })),
    missions: board.map((item) => ({
      id: item.id,
      number: item.number,
      name: item.name,
      status: item.status,
    })),
    assignedMissionIds: board
      .filter((item) => item.assignees.some((person) => person.id === viewerId))
      .map((item) => item.id),
    recentMeetings: recent.map((item) => ({
      id: item.id,
      label: `${weekdayDate(item.startsAt)} · ${
        item.sessionNumber != null ? sessionLabel(item.sessionNumber) : item.title?.trim() || "Meeting"
      }`,
    })),
  };
}

export function meetingHeading(startsAt: Date, sessionNumber: number | null) {
  return sessionNumber != null
    ? `${longDay(startsAt)} · ${sessionLabel(sessionNumber)}`
    : longDay(startsAt);
}
