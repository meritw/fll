import { redirect } from "next/navigation";

import { getSession, needsPasswordChange } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  redirect(needsPasswordChange(session.user) ? "/set-password" : "/programs");
}
