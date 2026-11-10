import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
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
    <AuthShell>
      <h1 className="sr-only">Rolling Sparks</h1>
      <LoginForm />
    </AuthShell>
  );
}
