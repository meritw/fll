"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";
import { DropdownMenu } from "radix-ui";

import { authClient } from "@/lib/auth-client";

const itemClass =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 text-lg outline-none select-none data-[highlighted]:bg-muted";

/** The signed-in person's name, top right. Opens Change password and Sign out. */
export function UserMenu({ name, hasPassword }: { name: string; hasPassword: boolean }) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 font-medium hover:bg-white/10 sm:px-3 data-[state=open]:bg-white/10"
        aria-label={`Account menu for ${name}`}
      >
        <span className="max-w-[6rem] truncate sm:max-w-[10rem]">{name}</span>
        <ChevronDown className="size-4 shrink-0" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-56 rounded-xl bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
        >
          <DropdownMenu.Label className="px-3 py-2 text-sm text-muted-foreground">
            Signed in as {name}
          </DropdownMenu.Label>
          {hasPassword ? (
            <DropdownMenu.Item asChild className={itemClass}>
              <Link href="/account/password">
                <KeyRound className="size-5" aria-hidden />
                Change password
              </Link>
            </DropdownMenu.Item>
          ) : null}
          <DropdownMenu.Item className={itemClass} onSelect={signOut}>
            <LogOut className="size-5" aria-hidden />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
