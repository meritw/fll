import Link from "next/link";

import { NavLink } from "@/components/nav-link";
import { SignOutButton } from "@/components/sign-out-button";
import { isCoach, isParent } from "@/lib/roles";

export function Header({ name, role }: { name: string; role: string }) {
  const coach = isCoach(role);
  const parent = isParent(role);
  const homeHref = parent ? "/journal" : "/home";

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href={homeHref} className="text-2xl font-semibold">
          Rolling Sparks
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-3">
          <span className="hidden sm:inline">{name}</span>
          {!parent ? <NavLink href="/home">Home</NavLink> : null}
          <NavLink href="/missions">Missions</NavLink>
          <NavLink href="/journal">Journal</NavLink>
          <NavLink href="/gallery">Gallery</NavLink>
          {coach ? <NavLink href="/conflicts">Conflicts</NavLink> : null}
          {coach ? <NavLink href="/admin">People</NavLink> : null}
          <SignOutButton />
        </nav>
      </div>
    </header>
  );
}
