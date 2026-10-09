import { eq } from "drizzle-orm";

import { user } from "@/db/schema";
import { getDb } from "@/db";
import { usesEmailSignIn } from "@/lib/roles";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isPlaceholderEmail(email: string) {
  const normalized = normalizeEmail(email);
  return (
    normalized.endsWith("@students.local") || normalized.endsWith(".local")
  );
}

/** Coach or parent with a real email (magic link / OTP / password reset). */
export async function findDeliverableEmailUser(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized || isPlaceholderEmail(normalized)) {
    return null;
  }

  const [row] = await getDb()
    .select()
    .from(user)
    .where(eq(user.email, normalized))
    .limit(1);

  if (!row || !usesEmailSignIn(row.role)) {
    return null;
  }

  return row;
}

/** @deprecated Prefer findDeliverableEmailUser — kept for callers that mean coach-only. */
export async function findDeliverableCoach(email: string) {
  const row = await findDeliverableEmailUser(email);
  if (!row || row.role !== "coach") {
    return null;
  }
  return row;
}
