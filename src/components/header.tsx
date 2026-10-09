import Link from "next/link";

import { NavLink } from "@/components/nav-link";
import { UserMenu } from "@/components/user-menu";
import { isCoach, isParent } from "@/lib/roles";

export function Header({
  name,
  role,
  hasPassword,
}: {
  name: string;
  role: string;
  hasPassword: boolean;
}) {
  const coach = isCoach(role);
  const parent = isParent(role);
  const homeHref = parent ? "/journal" : "/home";

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
        <Link href={homeHref} className="text-2xl font-semibold">
          Rolling Sparks
        </Link>
        {/* On phones the name stays top-right and the tabs take their own row. */}
        <nav
          aria-label="Main"
          className="order-last flex w-full flex-wrap items-center gap-x-4 gap-y-1 sm:order-none sm:ml-auto sm:w-auto"
        >
          {!parent ? <NavLink href="/home">Code</NavLink> : null}
          <NavLink href="/missions">Missions</NavLink>
          <NavLink href="/journal">Journal</NavLink>
          <NavLink href="/gallery">Gallery</NavLink>
          {coach ? <NavLink href="/conflicts">Conflicts</NavLink> : null}
          {coach ? <NavLink href="/admin">People</NavLink> : null}
        </nav>
        <UserMenu name={name} hasPassword={hasPassword} />
      </div>
    </header>
  );
}
