import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const session = await getSession();
  if (session) {
    redirect("/programs");
  }
  const params = await searchParams;
  const notice =
    params.notice === "link"
      ? "That link is used up or not ready. Ask for a new one."
      : null;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
      <h1 className="mb-8 text-center text-4xl font-semibold">Rolling Sparks</h1>
      <LoginForm notice={notice} />
    </main>
  );
}
