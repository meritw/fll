import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetPasswordForm } from "@/components/set-password-form";
import { getSession, needsPasswordChange } from "@/lib/session";

export const metadata: Metadata = {
  title: "Set a new password",
};

export default async function SetPasswordPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (!needsPasswordChange(session.user)) {
    redirect("/programs");
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
      <h1 className="mb-2 text-center text-5xl font-semibold tracking-tight">
        Rolling Sparks
      </h1>
      <h2 className="mb-8 text-center text-3xl font-semibold">Set a new password</h2>
      <SetPasswordForm username={session.user.username ?? session.user.name} />
    </main>
  );
}
