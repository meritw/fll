import { randomBytes } from "crypto";

import { APIError } from "better-auth/api";
import { hashPassword } from "better-auth/crypto";
import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { account, session, user } from "@/db/schema";
import { auth, internalSignupHeaders } from "@/lib/auth";
import { isPlaceholderEmail, normalizeEmail } from "@/lib/coaches";
import { isParent, isStudent, usesEmailSignIn, type Role } from "@/lib/roles";

const USERNAME = /^[a-z0-9._]{2,30}$/;

export async function createAccount(input: {
  username: string;
  displayName: string;
  password: string;
  role: Exclude<Role, "parent">;
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
  if (input.password.length < 3) {
    return { error: "Use at least 3 characters for the password." };
  }

  let email: string;
  if (usesEmailSignIn(input.role)) {
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
        emailVerified: usesEmailSignIn(input.role),
        mustChangePassword: isStudent(input.role),
        mustSetDisplayName: false,
        updatedAt: new Date(),
      })
      .where(eq(user.id, result.user.id));
    if (isStudent(input.role)) {
      const { ensurePybricksLicenses } = await import("@/lib/pybricks-licenses");
      await ensurePybricksLicenses();
    }
    return { ok: true as const };
  } catch (error) {
    return { error: accountErrorMessage(error) };
  }
}

/**
 * Coach invites a parent with email only. Username/password are internal;
 * parents sign in via magic link / OTP, then set their display name.
 */
export async function createParentAccount(emailInput: string) {
  const email = normalizeEmail(emailInput);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || isPlaceholderEmail(email)) {
    return { error: "Use a real email address." };
  }

  const username = parentUsernameFromEmail(email);
  const password = randomBytes(32).toString("hex");

  try {
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: "Parent",
        username,
      },
      headers: internalSignupHeaders(),
    });
    if (!result.user?.id) {
      return { error: "Could not add that parent. Try again." };
    }
    await getDb()
      .update(user)
      .set({
        role: "parent",
        emailVerified: true,
        mustChangePassword: false,
        mustSetDisplayName: true,
        updatedAt: new Date(),
      })
      .where(eq(user.id, result.user.id));
    return { ok: true as const };
  } catch (error) {
    return { error: accountErrorMessage(error) };
  }
}

function parentUsernameFromEmail(email: string) {
  const local = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 16);
  const base = local.length >= 2 ? local : "parent";
  const suffix = randomBytes(4).toString("hex");
  return `p.${base}.${suffix}`.slice(0, 30);
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
      mustSetDisplayName: user.mustSetDisplayName,
    })
    .from(user)
    .orderBy(asc(user.name));

  return rows.map((row) => ({
    id: row.id,
    name: isParent(row.role) && row.mustSetDisplayName ? "—" : row.name,
    username: isParent(row.role) ? "—" : (row.username ?? ""),
    role: row.role,
    email:
      usesEmailSignIn(row.role) && !isPlaceholderEmail(row.email) ? row.email : null,
  }));
}

/** Students only — for Attendance roster (never parents or coaches). */
export async function listStudents() {
  const people = await listPeople();
  return people.filter((person) => isStudent(person.role));
}

export async function resetStudentPassword(userId: string, password: string) {
  if (password.length < 3) {
    return { error: "Use at least 3 characters for the password." };
  }

  const [person] = await getDb()
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!person || !isStudent(person.role)) {
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

  await getDb()
    .update(user)
    .set({ mustChangePassword: true, updatedAt: new Date() })
    .where(eq(user.id, userId));
  await getDb().delete(session).where(eq(session.userId, userId));
  return { ok: true as const };
}

export async function clearMustChangePassword(userId: string) {
  await getDb()
    .update(user)
    .set({ mustChangePassword: false, updatedAt: new Date() })
    .where(eq(user.id, userId));
}

export async function setDisplayName(userId: string, displayName: string) {
  const name = displayName.trim();
  if (!name || name.length > 80) {
    return { error: "Add a name (up to 80 characters)." };
  }
  if (/^parent$/i.test(name)) {
    return { error: "Pick the name people should see (not “Parent”)." };
  }

  const [person] = await getDb()
    .select({ id: user.id, role: user.role, mustSetDisplayName: user.mustSetDisplayName })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!person || !isParent(person.role)) {
    return { error: "Only parents set a name this way." };
  }

  await getDb()
    .update(user)
    .set({
      name,
      mustSetDisplayName: false,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));
  return { ok: true as const };
}
