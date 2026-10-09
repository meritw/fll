import type { Metadata } from "next";
import { redirect } from "next/navigation";

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
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
      <h1 className="mb-2 text-center text-5xl font-semibold tracking-tight">
        Rolling Sparks
      </h1>
      <h2 className="mb-8 text-center text-3xl font-semibold">Choose your name</h2>
      <SetNameForm />
      <div className="mt-8 flex justify-center">
        <SignOutButton />
      </div>
    </main>
  );
}
