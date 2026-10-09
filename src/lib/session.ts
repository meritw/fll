import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { isCoach, isParent } from "@/lib/roles";

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

export function needsDisplayName(user: {
  mustSetDisplayName?: boolean | null;
}) {
  return Boolean(user.mustSetDisplayName);
}

export function postAuthPath(user: {
  role?: string | null;
  mustChangePassword?: boolean | null;
  mustSetDisplayName?: boolean | null;
}) {
  if (needsPasswordChange(user)) {
    return "/set-password";
  }
  if (needsDisplayName(user)) {
    return "/set-name";
  }
  if (isParent(user.role)) {
    return "/meetings";
  }
  return "/home";
}

export async function requireUser(options?: {
  allowPasswordChange?: boolean;
  allowSetDisplayName?: boolean;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (needsPasswordChange(session.user) && !options?.allowPasswordChange) {
    redirect("/set-password");
  }
  if (needsDisplayName(session.user) && !options?.allowSetDisplayName) {
    redirect("/set-name");
  }
  return session;
}

export async function requireCoach() {
  const session = await requireUser();
  if (!isCoach(session.user.role)) {
    redirect(isParent(session.user.role) ? "/meetings" : "/home");
  }
  return session;
}
