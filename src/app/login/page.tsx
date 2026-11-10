import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { TeamLockup } from "@/components/team-logo";
import { getSession, postAuthPath } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect(postAuthPath(session.user));
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-8 flex justify-center">
        <TeamLockup ink="auto" className="h-36 w-auto" priority />
      </div>
      <h1 className="sr-only">Rolling Sparks</h1>
      <LoginForm />
    </main>
  );
}
