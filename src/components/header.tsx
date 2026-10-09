import { Menu } from "lucide-react";
import Link from "next/link";

import { MobileMenu, NavLink } from "@/components/nav-link";
import { SignOutButton } from "@/components/sign-out-button";
import { isCoach, isParent } from "@/lib/roles";

export function Header({ name, role }: { name: string; role: string }) {
  const coach = isCoach(role);
  const parent = isParent(role);
  const homeHref = parent ? "/journal" : "/home";

  const links = [
    ...(parent ? [] : [{ href: "/home", label: "Home" }]),
    { href: "/missions", label: "Missions" },
    { href: "/journal", label: "Journal" },
    { href: "/gallery", label: "Gallery" },
    ...(coach
      ? [
          { href: "/conflicts", label: "Conflicts" },
          { href: "/admin", label: "People" },
        ]
      : []),
  ];

  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-4 py-3">
        <Link href={homeHref} className="text-2xl font-semibold">
          Rolling Sparks
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink key={link.href} href={link.href}>
              {link.label}
            </NavLink>
          ))}
          <span className="ml-3 hidden max-w-40 truncate text-ink-muted lg:inline">{name}</span>
          <span className="ml-2">
            <SignOutButton />
          </span>
        </nav>

        <MobileMenu label={<Menu className="size-6" aria-label="Open menu" />}>
          <p className="truncate px-3 py-1 text-base text-ink-muted">{name}</p>
          {links.map((link) => (
            <NavLink key={link.href} href={link.href}>
              {link.label}
            </NavLink>
          ))}
          <div className="px-1 pt-2">
            <SignOutButton />
          </div>
        </MobileMenu>
      </div>
    </header>
  );
}
