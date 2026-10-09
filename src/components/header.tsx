import Link from "next/link";
import { Zap } from "lucide-react";

import { NavLink } from "@/components/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";
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

  return (
    <header className="border-b border-header bg-header text-white dark:border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
        <Link href="/journal" className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">
          <Zap className="hidden size-6 sm:block" aria-hidden />
          Rolling Sparks
        </Link>
        {/* On phones the theme switch and name stay top-right and the tabs take their own row. */}
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
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <UserMenu name={name} hasPassword={hasPassword} />
        </div>
      </div>
    </header>
  );
}
