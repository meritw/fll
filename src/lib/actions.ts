"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import {
  clearMustChangePassword,
  createAccount,
  createParentAccount,
  hasPasswordLogin,
  resetStudentPassword,
  setDisplayName,
} from "@/lib/accounts";
import { findDeliverableEmailUser } from "@/lib/coaches";
import { addSeasonEvent, createJournalEntry, deleteSeasonEvent } from "@/lib/journal";
import { attachMeetingMedia, updateMediaCaption } from "@/lib/media";
import { VAGUE_EMAIL_MESSAGE } from "@/lib/messages";
import { parseParentInviteList } from "@/lib/parent-invites";
import {
  addMeetingNote,
  ensureMeetingForDay,
  ensureTodayMeeting,
  findTodayMeeting,
  setAttendance,
} from "@/lib/meetings";
import { isMissionStatus, MISSION_STATUS_LABELS } from "@/lib/mission-status";
import { isDayNoteKind, type DayNoteKind } from "@/lib/notebook";
import {
  addMissionAssignment,
  addMissionNote,
  removeMissionAssignment,
  setMissionStatus,
} from "@/lib/missions-board";
import {
  addProgramVersion,
  createProgram,
  renameProgram,
} from "@/lib/programs";
import { isCoach, isParent, isStudent } from "@/lib/roles";
import { requireCoach, requireUser } from "@/lib/session";

export async function requestMagicLink(email: string) {
  return sendAdultEmail(email, "link");
}

export async function requestEmailCode(email: string) {
  return sendAdultEmail(email, "code");
}

export async function requestPasswordReset(email: string) {
  return sendAdultEmail(email, "reset");
}

async function sendAdultEmail(email: string, kind: "link" | "code" | "reset") {
  const trimmed = email.trim();
  if (!trimmed) {
    return { message: "Add an email." };
  }

  const adult = await findDeliverableEmailUser(trimmed);
  if (adult) {
    try {
      const requestHeaders = await headers();
      const callbackURL = adult.mustSetDisplayName ? "/set-name" : "/journal";
      if (kind === "link") {
        await auth.api.signInMagicLink({
          body: { email: adult.email, callbackURL },
          headers: requestHeaders,
        });
      } else if (kind === "code") {
        await auth.api.sendVerificationOTP({
          body: { email: adult.email, type: "sign-in" },
          headers: requestHeaders,
        });
      } else {
        await auth.api.requestPasswordReset({
          body: { email: adult.email, redirectTo: "/reset-password" },
          headers: requestHeaders,
        });
      }
    } catch (error) {
      console.error(error);
    }
  }

  return { message: VAGUE_EMAIL_MESSAGE };
}

export async function saveProgramName(programId: string, name: string) {
  await requireUser();
  const result = await renameProgram(programId, name);
  if ("error" in result) {
    return result;
  }
  revalidatePath("/home");
  return { message: "Name saved." };
}

export async function addNewProgram(input: {
  name: string;
  note: string;
  missionIds: number[];
  objectKey: string;
  fileName: string;
}) {
  const session = await requireUser();
  const result = await createProgram({ ...input, userId: session.user.id });
  if ("error" in result && result.error) {
    return { error: result.error };
  }
  if (!("id" in result)) {
    return { error: "Could not save that program." };
  }
  revalidatePath("/home");
  redirect("/home");
}

export async function uploadProgramVersion(input: {
  programId: string;
  name: string;
  note: string;
  missionIds: number[];
  objectKey: string;
  fileName: string;
}) {
  const session = await requireUser();
  try {
    const result = await addProgramVersion({ ...input, userId: session.user.id });
    if ("error" in result && result.error) {
      return { error: result.error };
    }
    if (!("id" in result)) {
      return { error: "Could not save that version." };
    }
  } catch (error) {
    if (error instanceof Error && error.message === "MISSING_PROGRAM") {
      return { error: "That program is missing." };
    }
    throw error;
  }
  revalidatePath("/home");
  redirect("/home");
}

export async function addStudent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireCoach();
  const result = await createAccount({
    username: String(formData.get("username") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
    password: String(formData.get("password") ?? ""),
    role: "student",
  });
  if ("error" in result) {
    return result;
  }
  revalidatePath("/admin");
  return { message: "Student added." };
}

export async function addCoach(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireCoach();
  const result = await createAccount({
    username: String(formData.get("username") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
    password: String(formData.get("password") ?? ""),
    email: String(formData.get("email") ?? ""),
    role: "coach",
  });
  if ("error" in result) {
    return result;
  }
  revalidatePath("/admin");
  return { message: "Coach added." };
}

export async function addParent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireCoach();
  const pasted = String(formData.get("emails") ?? formData.get("email") ?? "");
  const { emails, invalid } = parseParentInviteList(pasted);

  if (emails.length === 0) {
    if (invalid.length > 0) {
      return {
        error: `No valid emails found. Check: ${invalid.slice(0, 5).join("; ")}${
          invalid.length > 5 ? "…" : ""
        }`,
      };
    }
    return { error: "Paste one or more parent emails." };
  }

  const invited: string[] = [];
  const failed: string[] = [];
  for (const email of emails) {
    const result = await createParentAccount(email);
    if ("error" in result) {
      failed.push(`${email} (${result.error})`);
    } else {
      invited.push(email);
    }
  }

  revalidatePath("/admin");

  if (invited.length === 0) {
    return {
      error: `Could not invite any parents. ${failed.slice(0, 8).join("; ")}${
        failed.length > 8 ? "…" : ""
      }`,
    };
  }

  const parts = [
    invited.length === 1
      ? "1 parent invited."
      : `${invited.length} parents invited.`,
    "They sign in with an email link or code, then choose their name.",
  ];
  if (failed.length > 0) {
    parts.push(
      `Skipped ${failed.length}: ${failed.slice(0, 6).join("; ")}${
        failed.length > 6 ? "…" : ""
      }`,
    );
  }
  if (invalid.length > 0) {
    parts.push(
      `Ignored ${invalid.length} invalid: ${invalid.slice(0, 4).join("; ")}${
        invalid.length > 4 ? "…" : ""
      }`,
    );
  }
  return { message: parts.join(" ") };
}

export async function setStudentPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireCoach();
  const result = await resetStudentPassword(
    String(formData.get("userId") ?? ""),
    String(formData.get("password") ?? ""),
  );
  if ("error" in result) {
    return result;
  }
  revalidatePath("/admin");
  return { message: "Password saved. They must pick a new one at sign-in." };
}

export async function completeForcedPasswordChange(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionState> {
  const session = await requireUser({ allowPasswordChange: true });
  if (!session.user.mustChangePassword) {
    return { message: "Password already updated." };
  }
  if (input.newPassword.length < 3) {
    return { error: "Pick a password with at least 3 characters." };
  }
  if (input.newPassword === input.currentPassword) {
    return { error: "Pick a new password that is different from the old one." };
  }

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } catch (error) {
    console.error(error);
    return { error: "Check the password from your coach, then try again." };
  }

  await clearMustChangePassword(session.user.id);
  return { message: "Password saved." };
}

/** Signed-in users change their own password from the name menu. */
export async function changeMyPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionState> {
  const session = await requireUser();
  if (!(await hasPasswordLogin(session.user.id))) {
    return { error: "You sign in with an email link, so there's no password to change." };
  }
  if (!input.currentPassword) {
    return { error: "Type your current password first." };
  }
  if (input.newPassword.length < 3) {
    return { error: "Pick a password with at least 3 characters." };
  }
  if (input.newPassword === input.currentPassword) {
    return { error: "Pick a new password that is different from the old one." };
  }

  const requestHeaders = await headers();
  try {
    // Keep this session as-is: revokeOtherSessions here would swap the session
    // cookie mid-action, and the re-render would bounce through /login.
    await auth.api.changePassword({
      body: {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        revokeOtherSessions: false,
      },
      headers: requestHeaders,
    });
  } catch (error) {
    console.error(error);
    return { error: "That current password isn't right. Try again." };
  }

  try {
    // Sign out other devices without touching this one.
    await auth.api.revokeOtherSessions({ headers: requestHeaders });
  } catch (error) {
    console.error("Could not sign out other devices", error);
  }

  return { message: "Password changed. Other devices are signed out." };
}

export async function completeSetDisplayName(input: {
  displayName: string;
}): Promise<ActionState> {
  const session = await requireUser({ allowSetDisplayName: true });
  if (!session.user.mustSetDisplayName) {
    return { message: "Name already saved." };
  }
  const result = await setDisplayName(session.user.id, input.displayName);
  if ("error" in result) {
    return result;
  }
  return { message: "Name saved." };
}

/** Students and coaches write the notebook; parents add photos and "other" notes. */
function canWriteNotebook(role: string | null | undefined) {
  return isStudent(role) || isCoach(role);
}

const NOT_FOR_PARENTS = "Team members and coaches add this part.";

function revalidateJournal(meetingId?: string | null) {
  revalidatePath("/journal");
  if (meetingId) {
    revalidatePath(`/journal/${meetingId}`);
  }
}

/** Start (or open) today's meeting, then go to its page. */
export async function startTodayMeeting() {
  const session = await requireUser();
  if (!canWriteNotebook(session.user.role)) {
    redirect("/journal");
  }
  const result = await ensureTodayMeeting(session.user.id);
  if (!result.ok) {
    redirect("/journal");
  }
  revalidateJournal(result.id);
  redirect(`/journal/${result.id}`);
}

/**
 * Open or create a meeting for a chosen day (today or earlier), with an optional
 * session number when creating. Used to backfill old journal days after the
 * calendar was removed.
 */
export async function startMeetingForDay(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  if (!canWriteNotebook(session.user.role)) {
    return { error: NOT_FOR_PARENTS };
  }

  const dayKey = String(formData.get("dayKey") ?? "").trim();
  const sessionRaw = String(formData.get("sessionNumber") ?? "").trim();
  const sessionNumber = sessionRaw ? Number(sessionRaw) : undefined;
  if (sessionRaw && (!Number.isFinite(sessionNumber) || (sessionNumber ?? 0) < 1)) {
    return { error: "Session number must be 1 or higher." };
  }

  const result = await ensureMeetingForDay({
    userId: session.user.id,
    dayKey,
    sessionNumber,
  });
  if (!result.ok) {
    return { error: result.error };
  }
  revalidateJournal(result.id);
  redirect(`/journal/${result.id}`);
}

async function requireTodayMeeting(userId: string): Promise<{ id: string } | { error: string }> {
  const result = await ensureTodayMeeting(userId);
  if (!result.ok) {
    return { error: result.error };
  }
  if (result.created) {
    revalidateJournal(result.id);
  }
  return { id: result.id };
}

/** Today's meeting id for uploads, starting the meeting if needed. */
export async function ensureTodayMeetingId(): Promise<{ id: string } | { error: string }> {
  const session = await requireUser();
  if (!canWriteNotebook(session.user.role)) {
    const today = await findTodayMeeting();
    return today
      ? { id: today.id }
      : { error: "There's no meeting today yet. Pick a meeting day above." };
  }
  return requireTodayMeeting(session.user.id);
}

export type AutoSaveResult = { error: string } | { ok: true; meetingId?: string; message: string };

/** One tap on a name. `meetingId: null` means today (and starts today's meeting). */
export async function toggleAttendance(input: {
  meetingId: string | null;
  userId: string;
  present: boolean;
}): Promise<AutoSaveResult> {
  const session = await requireUser();
  if (!canWriteNotebook(session.user.role)) {
    return { error: NOT_FOR_PARENTS };
  }
  let meetingId = input.meetingId;
  if (!meetingId) {
    const started = await requireTodayMeeting(session.user.id);
    if ("error" in started) {
      return { error: started.error };
    }
    meetingId = started.id;
  }
  const result = await setAttendance({
    meetingId,
    userId: input.userId,
    present: input.present,
    recordedById: session.user.id,
  });
  if ("error" in result) {
    return { error: result.error ?? "That didn't save. Try again." };
  }
  revalidateJournal(meetingId);
  return {
    ok: true,
    meetingId,
    message: `${result.name} is marked ${input.present ? "here" : "away"}.`,
  };
}

/**
 * A note from the day page. Notebook kinds go to the meeting's notebook; "other"
 * and milestones become journal entries. `meetingId: "home"` = not at a meeting.
 */
export async function postDayNote(input: {
  meetingId: string | null;
  kind: DayNoteKind;
  body: string;
  milestone: boolean;
}): Promise<AutoSaveResult> {
  const session = await requireUser();
  const writer = canWriteNotebook(session.user.role);
  if (!isDayNoteKind(input.kind)) {
    return { error: "Pick a kind of note." };
  }
  if (!writer && (input.kind !== "other" || input.milestone)) {
    return { error: NOT_FOR_PARENTS };
  }

  let meetingId: string | null;
  if (input.meetingId === "home") {
    meetingId = null;
  } else if (input.meetingId) {
    meetingId = input.meetingId;
  } else if (writer) {
    const started = await requireTodayMeeting(session.user.id);
    if ("error" in started) {
      return { error: started.error };
    }
    meetingId = started.id;
  } else {
    meetingId = (await findTodayMeeting())?.id ?? null;
  }

  if (input.kind === "other" || input.milestone || !meetingId) {
    const result = await createJournalEntry({
      authorId: session.user.id,
      body: input.body,
      relatedMeetingId: meetingId,
      milestone: input.milestone,
      fromHome: input.meetingId === "home",
    });
    if ("error" in result) {
      return { error: result.error ?? "That didn't save. Try again." };
    }
  } else {
    const result = await addMeetingNote({
      meetingId,
      authorId: session.user.id,
      body: input.body,
      kind: input.kind,
    });
    if ("error" in result) {
      return { error: result.error ?? "That didn't save. Try again." };
    }
  }
  revalidateJournal(meetingId);
  return {
    ok: true,
    meetingId: meetingId ?? undefined,
    message: input.milestone ? "Milestone added to the timeline." : "Added to the journal.",
  };
}

export async function saveMediaCaption(input: {
  mediaId: string;
  caption: string;
}): Promise<AutoSaveResult> {
  const session = await requireUser();
  const result = await updateMediaCaption({
    ...input,
    userId: session.user.id,
    isCoach: isCoach(session.user.role),
  });
  if ("error" in result) {
    return { error: result.error ?? "That didn't save. Try again." };
  }
  revalidateJournal(result.meetingId);
  revalidatePath("/gallery");
  return { ok: true, message: "Caption saved." };
}

function revalidateMissions(meetingId?: string | null) {
  revalidatePath("/missions");
  revalidateJournal(meetingId);
}

export async function setMissionStatusAction(input: {
  missionId: number;
  status: string;
  meetingId?: string | null;
}): Promise<AutoSaveResult> {
  const session = await requireUser();
  if (!canWriteNotebook(session.user.role)) {
    return { error: NOT_FOR_PARENTS };
  }
  if (!isMissionStatus(input.status)) {
    return { error: "Pick how it's going." };
  }
  const result = await setMissionStatus({
    missionId: input.missionId,
    status: input.status,
    userId: session.user.id,
    meetingId: input.meetingId,
  });
  if ("error" in result) {
    return { error: result.error ?? "That didn't save. Try again." };
  }
  revalidateMissions(input.meetingId);
  return {
    ok: true,
    message: `${result.missionName}: ${MISSION_STATUS_LABELS[input.status].toLowerCase()}.`,
  };
}

/** Students join or leave a mission themselves. */
export async function setMyMission(input: {
  missionId: number;
  join: boolean;
}): Promise<AutoSaveResult> {
  const session = await requireUser();
  if (!isStudent(session.user.role)) {
    return { error: "Students choose their own missions. Coaches can assign team members below." };
  }
  const result = input.join
    ? await addMissionAssignment({
        missionId: input.missionId,
        userId: session.user.id,
        assignedById: session.user.id,
      })
    : await removeMissionAssignment({ missionId: input.missionId, userId: session.user.id });
  if ("error" in result) {
    return { error: result.error ?? "That didn't save. Try again." };
  }
  revalidateMissions();
  return { ok: true, message: input.join ? "You're on this mission." : "You left this mission." };
}

/** Coaches add or remove any student on a mission. */
export async function setMissionAssignment(input: {
  missionId: number;
  userId: string;
  assigned: boolean;
}): Promise<AutoSaveResult> {
  const session = await requireUser();
  if (!isCoach(session.user.role)) {
    return { error: "Only coaches can change who's on a mission." };
  }
  const result = input.assigned
    ? await addMissionAssignment({
        missionId: input.missionId,
        userId: input.userId,
        assignedById: session.user.id,
      })
    : await removeMissionAssignment({ missionId: input.missionId, userId: input.userId });
  if ("error" in result) {
    return { error: result.error ?? "That didn't save. Try again." };
  }
  revalidateMissions();
  return { ok: true, message: "Saved." };
}

export async function postMissionNote(input: {
  missionId: number;
  body: string;
  meetingId?: string | null;
}): Promise<AutoSaveResult> {
  const session = await requireUser();
  if (!canWriteNotebook(session.user.role)) {
    return { error: NOT_FOR_PARENTS };
  }
  const result = await addMissionNote({
    missionId: input.missionId,
    body: input.body,
    authorId: session.user.id,
    meetingId: input.meetingId,
  });
  if ("error" in result) {
    return { error: result.error ?? "That didn't save. Try again." };
  }
  revalidateMissions(input.meetingId);
  return { ok: true, message: "Note saved." };
}

export async function addSeasonDate(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireCoach();
  const result = await addSeasonEvent({
    title: String(formData.get("title") ?? ""),
    dayKey: String(formData.get("dayKey") ?? ""),
    userId: session.user.id,
  });
  if ("error" in result) {
    return { error: result.error };
  }
  revalidatePath("/journal");
  return { message: "Date added." };
}

export async function removeSeasonDate(formData: FormData) {
  await requireCoach();
  await deleteSeasonEvent(String(formData.get("id") ?? ""));
  revalidatePath("/journal");
}

export async function saveMeetingMedia(input: {
  meetingId: string;
  objectKey: string;
  contentType: string;
  size: number;
  fileName: string;
  caption?: string;
}) {
  const session = await requireUser();
  const result = await attachMeetingMedia({
    ...input,
    uploaderId: session.user.id,
  });
  if ("error" in result) {
    return result;
  }
  revalidateJournal(input.meetingId);
  revalidatePath("/gallery");
  return { message: "Added to the journal.", id: result.id };
}

export type TeamProjectUploadResult =
  | { error: string }
  | { status: "seeded" | "merged"; sha: string; uploadId: string }
  | { status: "conflict"; uploadId: string; conflictCount: number };

export async function submitTeamProjectUpload(input: {
  objectKey: string;
  fileName: string;
  message: string;
  baseSha?: string | null;
}): Promise<TeamProjectUploadResult> {
  const session = await requireUser();
  if (isParent(session.user.role)) {
    return { error: "Parents cannot upload team project code." };
  }
  const { ingestTeamProjectUpload } = await import("@/lib/team-project");
  const result = await ingestTeamProjectUpload({
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    objectKey: input.objectKey,
    fileName: input.fileName,
    message: input.message,
    baseSha: input.baseSha,
  });
  if ("error" in result) {
    return { error: result.error ?? "Upload failed." };
  }
  revalidatePath("/home");
  revalidatePath("/conflicts");
  return result;
}

export type TeamProjectResolveResult =
  | { error: string }
  | { status: "partial"; remaining: number }
  | { status: "committed"; sha: string };

export async function resolveTeamProjectConflict(input: {
  conflictId: string;
  choice: "ours" | "theirs" | "custom";
  customText?: string;
}): Promise<TeamProjectResolveResult> {
  const session = await requireCoach();
  const { resolveConflict } = await import("@/lib/team-project");
  const result = await resolveConflict({
    conflictId: input.conflictId,
    coachUserId: session.user.id,
    coachName: session.user.name,
    coachEmail: session.user.email,
    choice: input.choice,
    customText: input.customText,
  });
  if ("error" in result) {
    return { error: result.error ?? "Could not resolve that conflict." };
  }
  revalidatePath("/home");
  revalidatePath("/conflicts");
  revalidatePath(`/conflicts/${input.conflictId}`);
  return result;
}

export async function submitCoachFixedZip(input: {
  objectKey: string;
  fileName: string;
  message?: string;
}): Promise<{ error: string } | { status: "merged"; sha: string; uploadId: string }> {
  const session = await requireCoach();
  const { coachForceUpload } = await import("@/lib/team-project");
  const result = await coachForceUpload({
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    objectKey: input.objectKey,
    fileName: input.fileName,
    message: input.message,
  });
  if ("error" in result) {
    return { error: result.error ?? "Upload failed." };
  }
  revalidatePath("/home");
  revalidatePath("/conflicts");
  return result;
}

export type ActionState = {
  error?: string;
  message?: string;
};
