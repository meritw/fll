import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth-shell";
import { SetNameForm } from "@/components/set-name-form";
import { SignOutButton } from "@/components/sign-out-button";
import { getSession, needsDisplayName, postAuthPath } from "@/lib/session";

export const metadata: Metadata = {
  title: "Choose your name",
};

export default async function SetNamePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (!needsDisplayName(session.user)) {
    redirect(postAuthPath(session.user));
  }

  return (
    <AuthShell>
      <h1 className="sr-only">Rolling Sparks</h1>
      <h2 className="mb-8 text-center text-3xl font-semibold">Choose your name</h2>
      <SetNameForm />
      <div className="mt-8 flex justify-center">
        <SignOutButton />
      </div>
    </AuthShell>
  );
}
