"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { clearMustChangePassword, createAccount, resetStudentPassword } from "@/lib/accounts";
import { findDeliverableCoach } from "@/lib/coaches";
import { VAGUE_EMAIL_MESSAGE } from "@/lib/messages";
import {
  addProgramVersion,
  createProgram,
  renameProgram,
} from "@/lib/programs";
import { requireCoach, requireUser } from "@/lib/session";

export async function requestMagicLink(email: string) {
  return sendCoachEmail(email, "link");
}

export async function requestEmailCode(email: string) {
  return sendCoachEmail(email, "code");
}

export async function requestPasswordReset(email: string) {
  return sendCoachEmail(email, "reset");
}

async function sendCoachEmail(email: string, kind: "link" | "code" | "reset") {
  const trimmed = email.trim();
  if (!trimmed) {
    return { message: "Add an email." };
  }

  const coach = await findDeliverableCoach(trimmed);
  if (coach) {
    try {
      const requestHeaders = await headers();
      if (kind === "link") {
        await auth.api.signInMagicLink({
          body: { email: coach.email, callbackURL: "/programs" },
          headers: requestHeaders,
        });
      } else if (kind === "code") {
        await auth.api.sendVerificationOTP({
          body: { email: coach.email, type: "sign-in" },
          headers: requestHeaders,
        });
      } else {
        await auth.api.requestPasswordReset({
          body: { email: coach.email, redirectTo: "/reset-password" },
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
  revalidatePath("/programs");
  revalidatePath(`/programs/${programId}`);
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
  revalidatePath("/programs");
  redirect(`/programs/${result.id}`);
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
  revalidatePath("/programs");
  revalidatePath(`/programs/${input.programId}`);
  redirect(`/programs/${input.programId}`);
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
  if (input.newPassword.length < 8) {
    return { error: "Pick a password with at least 8 characters." };
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

export type ActionState = {
  error?: string;
  message?: string;
};
