import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";

export function Header({ name, isCoach }: { name: string; isCoach: boolean }) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/programs" className="text-2xl font-semibold">
          Rolling Sparks
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">{name}</span>
          <Link href="/programs" className="font-medium underline-offset-4 hover:underline">
            Programs
          </Link>
          {isCoach ? (
            <Link href="/admin" className="font-medium underline-offset-4 hover:underline">
              People
            </Link>
          ) : null}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
