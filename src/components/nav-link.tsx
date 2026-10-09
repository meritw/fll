"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "font-semibold text-white underline decoration-2 underline-offset-[6px]"
          : "font-medium text-white/85 underline-offset-4 hover:text-white hover:underline"
      }
    >
      {children}
    </Link>
  );
}
