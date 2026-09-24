import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { mission, user } from "@/db/schema";
import { createAccount } from "@/lib/accounts";
import { MISSIONS } from "@/lib/missions";

export async function ensureMissions() {
  await getDb()
    .insert(mission)
    .values(MISSIONS.map(([number, name]) => ({ number, name })))
    .onConflictDoNothing({ target: mission.number });
}

export async function ensureFirstCoach() {
  const username = process.env.COACH_USERNAME?.trim().toLowerCase();
  const password = process.env.COACH_PASSWORD;
  const email = process.env.COACH_EMAIL?.trim().toLowerCase();
  if (!username || !password || !email) {
    return;
  }

  const [existing] = await getDb()
    .select({ id: user.id, email: user.email, role: user.role })
    .from(user)
    .where(eq(user.username, username))
    .limit(1);
  if (existing) {
    if (existing.email !== email || existing.role !== "coach") {
      const [emailOwner] = await getDb()
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, email))
        .limit(1);
      if (emailOwner && emailOwner.id !== existing.id) {
        // Another account already owns COACH_EMAIL — do not steal it.
        if (existing.role !== "coach") {
          await getDb()
            .update(user)
            .set({ role: "coach", updatedAt: new Date() })
            .where(eq(user.id, existing.id));
        }
        return;
      }
      await getDb()
        .update(user)
        .set({
          email,
          role: "coach",
          emailVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(user.id, existing.id));
    }
    return;
  }

  const result = await createAccount({
    username,
    displayName: username,
    password,
    role: "coach",
    email,
  });
  if ("error" in result) {
    console.error("Could not create the first coach.", result.error);
  }
}

export async function bootstrap() {
  await ensureMissions();
  await ensureFirstCoach();
}
