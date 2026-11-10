import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth-shell";
import { SetPasswordForm } from "@/components/set-password-form";
import { SignOutButton } from "@/components/sign-out-button";
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
    redirect("/journal");
  }

  return (
    <AuthShell>
      <h1 className="sr-only">Rolling Sparks</h1>
      <h2 className="mb-8 text-center text-3xl font-semibold">Set a new password</h2>
      <SetPasswordForm username={session.user.username ?? session.user.name} />
      <div className="mt-8 flex justify-center">
        <SignOutButton />
      </div>
    </AuthShell>
  );
}
