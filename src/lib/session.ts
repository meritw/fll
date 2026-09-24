import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export function needsPasswordChange(user: {
  mustChangePassword?: boolean | null;
}) {
  return Boolean(user.mustChangePassword);
}

export async function requireUser(options?: { allowPasswordChange?: boolean }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (needsPasswordChange(session.user) && !options?.allowPasswordChange) {
    redirect("/set-password");
  }
  return session;
}

export async function requireCoach() {
  const session = await requireUser();
  if (session.user.role !== "coach") {
    redirect("/programs");
  }
  return session;
}
