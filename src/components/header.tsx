import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import { isCoach, isParent } from "@/lib/roles";

export function Header({ name, role }: { name: string; role: string }) {
  const coach = isCoach(role);
  const parent = isParent(role);
  const homeHref = parent ? "/meetings" : "/home";

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href={homeHref} className="text-2xl font-semibold">
          Rolling Sparks
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-3">
          <span className="hidden sm:inline">{name}</span>
          {!parent ? (
            <Link href="/home" className="font-medium underline-offset-4 hover:underline">
              Home
            </Link>
          ) : null}
          {coach ? (
            <Link href="/conflicts" className="font-medium underline-offset-4 hover:underline">
              Conflicts
            </Link>
          ) : null}
          <Link href="/meetings" className="font-medium underline-offset-4 hover:underline">
            Meetings
          </Link>
          <Link href="/journal" className="font-medium underline-offset-4 hover:underline">
            Journal
          </Link>
          <Link href="/gallery" className="font-medium underline-offset-4 hover:underline">
            Gallery
          </Link>
          {coach ? (
            <Link href="/admin" className="font-medium underline-offset-4 hover:underline">
              People
            </Link>
          ) : null}
          <SignOutButton />
        </nav>
      </div>
    </header>
  );
}
