"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { cn } from "cn";

import { isImage } from "@/components/journal/media-thumb";

export type LightboxItem = {
  id: string;
  contentType: string;
  caption: string | null;
  /** Read out when there is no caption, e.g. "Session 12 · Thu, Oct 9". */
  fallbackLabel: string;
  /** Small line under the caption: who added it, when. */
  detail?: string;
  /** Optional link to where the item lives, e.g. its journal day. */
  link?: { href: string; label: string };
};

/** A finger drag at least this far sideways flips to the next or previous item. */
const SWIPE_PX = 50;

const navButton =
  "inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:outline-none disabled:opacity-30";

/**
 * Full-screen viewer for photos and videos. The caller owns which item is open
 * (`index`, null when closed); arrows, keys and swipes move within `items`.
 */
export function MediaLightbox({
  items,
  index,
  onIndexChange,
}: {
  items: LightboxItem[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
}) {
  const touchX = useRef<number | null>(null);
  const current = index === null ? null : items[index];
  const step = (by: number) => {
    if (index === null) return;
    onIndexChange(Math.min(Math.max(index + by, 0), items.length - 1));
  };
  const close = () => onIndexChange(null);
  const label = (item: LightboxItem) => item.caption?.trim() || item.fallbackLabel;

  return (
    <Dialog.Root open={current != null} onOpenChange={(next) => (next ? null : close())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col text-white outline-none"
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") step(1);
            if (event.key === "ArrowLeft") step(-1);
          }}
          onTouchStart={(event) => {
            touchX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = touchX.current;
            const end = event.changedTouches[0]?.clientX;
            touchX.current = null;
            if (start == null || end == null || Math.abs(end - start) < SWIPE_PX) return;
            step(end < start ? 1 : -1);
          }}
        >
          {current && index !== null ? (
            <>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="font-mono text-sm text-white/70">
                  {items.length > 1 ? `${index + 1} of ${items.length}` : ""}
                </p>
                <Dialog.Close className={navButton} aria-label="Close">
                  <X className="size-6" aria-hidden />
                </Dialog.Close>
              </div>

              <div className="flex min-h-0 flex-1 items-center justify-center gap-2 px-2 sm:gap-4 sm:px-4">
                {items.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    disabled={index === 0}
                    aria-label="Previous"
                    className={cn(navButton, "hidden sm:inline-flex")}
                  >
                    <ChevronLeft className="size-7" aria-hidden />
                  </button>
                ) : null}
                {/* Clicking the dark space around the photo closes, like most lightboxes. */}
                <div
                  className="flex size-full min-w-0 items-center justify-center"
                  onClick={(event) => {
                    if (event.target === event.currentTarget) close();
                  }}
                >
                  {isImage(current.contentType) ? (
                    // Auth-gated app route; not a public CDN URL.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={current.id}
                      src={`/media/${current.id}`}
                      alt={label(current)}
                      className="max-h-full max-w-full rounded-lg object-contain"
                    />
                  ) : (
                    <video
                      key={current.id}
                      src={`/media/${current.id}`}
                      controls
                      autoPlay
                      playsInline
                      aria-label={label(current)}
                      className="max-h-full max-w-full rounded-lg bg-black"
                    />
                  )}
                </div>
                {items.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => step(1)}
                    disabled={index === items.length - 1}
                    aria-label="Next"
                    className={cn(navButton, "hidden sm:inline-flex")}
                  >
                    <ChevronRight className="size-7" aria-hidden />
                  </button>
                ) : null}
              </div>

              <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-4 pt-3 pb-5 text-center">
                <Dialog.Title
                  className={current.caption?.trim() ? "text-lg whitespace-pre-wrap" : "sr-only"}
                >
                  {label(current)}
                </Dialog.Title>
                <Dialog.Description className="text-base text-white/75">
                  {current.link ? (
                    <>
                      <Link
                        href={current.link.href}
                        onClick={close}
                        className="font-medium text-white underline-offset-4 hover:underline"
                      >
                        {current.link.label}
                      </Link>
                      {current.detail ? " · " : null}
                    </>
                  ) : null}
                  {current.detail}
                </Dialog.Description>
                {/* Phones: swipe, or use these. */}
                {items.length > 1 ? (
                  <div className="mt-2 flex justify-center gap-6 sm:hidden">
                    <button
                      type="button"
                      onClick={() => step(-1)}
                      disabled={index === 0}
                      aria-label="Previous"
                      className={navButton}
                    >
                      <ChevronLeft className="size-7" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => step(1)}
                      disabled={index === items.length - 1}
                      aria-label="Next"
                      className={navButton}
                    >
                      <ChevronRight className="size-7" aria-hidden />
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
