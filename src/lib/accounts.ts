import { APIError } from "better-auth/api";
import { hashPassword } from "better-auth/crypto";
import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { account, session, user } from "@/db/schema";
import { auth, internalSignupHeaders } from "@/lib/auth";
import { isPlaceholderEmail, normalizeEmail } from "@/lib/coaches";

const USERNAME = /^[a-z0-9._]{2,30}$/;

export async function createAccount(input: {
  username: string;
  displayName: string;
  password: string;
  role: "coach" | "student";
  email?: string;
}) {
  const username = input.username.trim().toLowerCase();
  const displayName = input.displayName.trim();
  if (!USERNAME.test(username)) {
    return { error: "Use 2 to 30 letters, numbers, dots, or underscores." };
  }
  if (!displayName || displayName.length > 80) {
    return { error: "Add a name." };
  }
  if (input.password.length < 8) {
    return { error: "Use at least 8 characters for the password." };
  }

  let email: string;
  if (input.role === "coach") {
    email = normalizeEmail(input.email ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || isPlaceholderEmail(email)) {
      return { error: "Use a real email address." };
    }
  } else {
    email = `${username}@students.local`;
  }

  try {
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password: input.password,
        name: displayName,
        username,
      },
      headers: internalSignupHeaders(),
    });
    if (!result.user?.id) {
      return { error: "Could not add that person. Try again." };
    }
    await getDb()
      .update(user)
      .set({
        role: input.role,
        emailVerified: input.role === "coach",
        updatedAt: new Date(),
      })
      .where(eq(user.id, result.user.id));
    return { ok: true as const };
  } catch (error) {
    return { error: accountErrorMessage(error) };
  }
}

function accountErrorMessage(error: unknown) {
  const message =
    error instanceof APIError
      ? `${error.message} ${JSON.stringify(error.body ?? "")}`
      : error instanceof Error
        ? error.message
        : "";
  if (/username/i.test(message)) {
    return "That username is already used. Pick another.";
  }
  if (/email/i.test(message)) {
    return "That email is already used.";
  }
  console.error(error);
  return "Could not add that person. Try again.";
}

export async function listPeople() {
  const rows = await getDb()
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
    })
    .from(user)
    .orderBy(asc(user.name));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    username: row.username ?? "",
    role: row.role,
    email: row.role === "coach" && !isPlaceholderEmail(row.email) ? row.email : null,
  }));
}

export async function resetStudentPassword(userId: string, password: string) {
  if (password.length < 8) {
    return { error: "Use at least 8 characters for the password." };
  }

  const [person] = await getDb()
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!person || person.role !== "student") {
    return { error: "Pick a student." };
  }

  const hashed = await hashPassword(password);
  const updated = await getDb()
    .update(account)
    .set({ password: hashed, updatedAt: new Date() })
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
    .returning({ id: account.id });
  if (updated.length === 0) {
    return { error: "Could not set that password. Try again." };
  }

  await getDb().delete(session).where(eq(session.userId, userId));
  return { ok: true as const };
}
