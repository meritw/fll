import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getSession, needsPasswordChange } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect(needsPasswordChange(session.user) ? "/set-password" : "/programs");
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
      <h1 className="mb-8 text-center text-4xl font-semibold">Rolling Sparks</h1>
      <LoginForm />
    </main>
  );
}
