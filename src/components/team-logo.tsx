import Image from "next/image";

import { cn } from "@/lib/utils";

const MARK = {
  white: {
    src: "/brand/rolling-sparks-mark-white.png",
    width: 655,
    height: 587,
  },
  black: {
    src: "/brand/rolling-sparks-mark-black.png",
    width: 655,
    height: 587,
  },
} as const;

const LOCKUP = {
  white: {
    src: "/brand/rolling-sparks-logo-white.png",
    width: 674,
    height: 782,
  },
  black: {
    src: "/brand/rolling-sparks-logo-black.png",
    width: 674,
    height: 782,
  },
} as const;

type Ink = "white" | "black";

/**
 * Wolf mark for compact brand spots (nav). Full lockup includes
 * "Rolling Sparks" + team number for hero / sign-in.
 */
export function TeamMark({
  ink = "white",
  className,
  priority = false,
}: {
  ink?: Ink | "auto";
  className?: string;
  priority?: boolean;
}) {
  if (ink === "auto") {
    return (
      <>
        <Image
          {...MARK.black}
          alt=""
          aria-hidden
          priority={priority}
          className={cn("h-8 w-auto dark:hidden", className)}
        />
        <Image
          {...MARK.white}
          alt=""
          aria-hidden
          priority={priority}
          className={cn("hidden h-8 w-auto dark:block", className)}
        />
      </>
    );
  }

  const asset = MARK[ink];
  return (
    <Image
      {...asset}
      alt=""
      aria-hidden
      priority={priority}
      className={cn("h-8 w-auto", className)}
    />
  );
}

export function TeamLockup({
  ink = "white",
  className,
  priority = false,
  alt = "Rolling Sparks",
}: {
  ink?: Ink | "auto";
  className?: string;
  priority?: boolean;
  alt?: string;
}) {
  if (ink === "auto") {
    return (
      <>
        <Image
          {...LOCKUP.black}
          alt={alt}
          priority={priority}
          className={cn("h-40 w-auto dark:hidden", className)}
        />
        <Image
          {...LOCKUP.white}
          alt=""
          aria-hidden
          priority={priority}
          className={cn("hidden h-40 w-auto dark:block", className)}
        />
      </>
    );
  }

  const asset = LOCKUP[ink];
  return (
    <Image
      {...asset}
      alt={alt}
      priority={priority}
      className={cn("h-40 w-auto", className)}
    />
  );
}
