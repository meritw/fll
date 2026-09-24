"use server";

import { randomBytes, randomUUID } from "node:crypto";

import { and, eq, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { verification } from "@/db/schema";
import { rememberAppSession } from "@/lib/app-session";
import { createAccount, resetStudentPassword, setCredentialPassword } from "@/lib/accounts";
import { findDeliverableCoach } from "@/lib/coaches";
import { BAD_CODE_MESSAGE, VAGUE_EMAIL_MESSAGE } from "@/lib/messages";
import {
  consumeNeonPasswordReset,
  ensureNeonCoach,
  neonResetEmail,
  sendNeonEmailCode,
  sendNeonMagicLink,
  sendNeonPasswordReset,
  verifyNeonEmailCode,
} from "@/lib/neon-mail";
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
      const ready = await ensureNeonCoach(coach.email, coach.name);
      if (ready && kind === "link") {
        const nonce = randomBytes(32).toString("base64url");
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await getDb()
          .delete(verification)
          .where(
            and(eq(verification.value, coach.email), like(verification.identifier, "neon-link:%")),
          );
        await getDb().insert(verification).values({
          id: randomUUID(),
          identifier: `neon-link:${nonce}`,
          value: coach.email,
          expiresAt,
        });
        const callbackURL = `${appBaseUrl()}/auth/continue?nonce=${nonce}`;
        await sendNeonMagicLink(coach.email, callbackURL);
      } else if (ready && kind === "code") {
        await sendNeonEmailCode(coach.email);
      } else if (ready) {
        await sendNeonPasswordReset(coach.email, `${appBaseUrl()}/reset-password`);
      }
    } catch (error) {
      console.error(error);
    }
  }

  return { message: VAGUE_EMAIL_MESSAGE };
}

function appBaseUrl() {
  return (process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function signInWithCoachCode(email: string, otp: string) {
  const coach = await findDeliverableCoach(email);
  const code = otp.trim();
  if (!coach || !code) {
    return { error: BAD_CODE_MESSAGE };
  }
  const verified = await verifyNeonEmailCode(coach.email, code);
  if (!verified.ok) {
    return { error: BAD_CODE_MESSAGE };
  }
  await rememberAppSession(coach.id);
  return { ok: true as const };
}

const RESET_TOKEN = /^[A-Za-z0-9]{10,128}$/;

export async function saveResetPassword(token: string, password: string, confirm: string) {
  if (!RESET_TOKEN.test(token)) {
    return { error: "That reset link is used up. Ask a coach to send a new one." };
  }
  if (password.length < 8) {
    return { error: "Use at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Those passwords do not match." };
  }

  const email = await neonResetEmail(token);
  const coach = email ? await findDeliverableCoach(email) : null;
  if (!coach) {
    return { error: "That reset link is used up. Ask a coach to send a new one." };
  }

  const updated = await setCredentialPassword(coach.id, password);
  if ("error" in updated) {
    return updated;
  }
  await consumeNeonPasswordReset(token, password);
  return { ok: true as const };
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
  return { message: "Password saved. Tell them the new one." };
}

export type ActionState = {
  error?: string;
  message?: string;
};
