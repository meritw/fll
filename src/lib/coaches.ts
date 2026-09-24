import { eq } from "drizzle-orm";

import { user } from "@/db/schema";
import { getDb } from "@/db";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isPlaceholderEmail(email: string) {
  const normalized = normalizeEmail(email);
  return (
    normalized.endsWith("@students.local") || normalized.endsWith(".local")
  );
}

export async function findDeliverableCoach(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized || isPlaceholderEmail(normalized)) {
    return null;
  }

  const [row] = await getDb()
    .select()
    .from(user)
    .where(eq(user.email, normalized))
    .limit(1);

  if (!row || row.role !== "coach") {
    return null;
  }

  return row;
}
