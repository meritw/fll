"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function NavLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center rounded-xl px-3 font-medium underline-offset-8 transition-colors hover:text-primary",
        active ? "text-primary underline decoration-2" : "text-ink",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Mobile menu; keyed by path so it closes itself after navigating. */
export function MobileMenu({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <details key={pathname} className="group relative md:hidden">
      <summary className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-line bg-card px-3 [&::-webkit-details-marker]:hidden">
        {label}
      </summary>
      <div className="absolute right-0 top-full z-30 mt-2 flex w-64 flex-col gap-1 rounded-2xl border border-line bg-card p-3 shadow-lg">
        {children}
      </div>
    </details>
  );
}
