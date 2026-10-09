"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { cn } from "cn";

export type GalleryItem = {
  id: string;
  meetingId: string;
  contentType: string;
  caption: string | null;
  uploaderName: string;
  createdLabel: string;
  sessionLabel: string;
  sessionDay: string;
};

function isImage(contentType: string) {
  return contentType.startsWith("image/");
}

function isVideo(contentType: string) {
  return contentType.startsWith("video/");
}

function altFor(item: GalleryItem) {
  return item.caption?.trim() || `${item.sessionLabel} · ${item.sessionDay}`;
}

/** A finger drag at least this far sideways flips to the next or previous item. */
const SWIPE_PX = 50;

const navButton =
  "inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:outline-none disabled:opacity-30";

export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);

  if (items.length === 0) {
    return (
      <p className="text-lg text-muted-foreground">
        No photos or videos yet. Add them from a meeting session page.
      </p>
    );
  }

  const current = open === null ? null : items[open];
  const step = (by: number) =>
    setOpen((index) => (index === null ? null : Math.min(Math.max(index + by, 0), items.length - 1)));

  return (
    <>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <li key={item.id} className="flex flex-col gap-2">
            {isImage(item.contentType) || isVideo(item.contentType) ? (
              <button
                type="button"
                onClick={() => setOpen(index)}
                aria-label={`View larger: ${altFor(item)}`}
                className="group relative overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
              >
                {isImage(item.contentType) ? (
                  // Auth-gated app route; not a public CDN URL.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/media/${item.id}`}
                    alt=""
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                ) : (
                  <>
                    {/* #t= nudges iOS to paint the first frame as a preview. */}
                    <video
                      src={`/media/${item.id}#t=0.1`}
                      muted
                      playsInline
                      preload="metadata"
                      className="aspect-[4/3] w-full bg-black object-cover"
                    />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex size-14 items-center justify-center rounded-full bg-black/55 text-white transition-transform group-hover:scale-110">
                        <Play className="ml-1 size-7 fill-white" aria-hidden />
                      </span>
                    </span>
                  </>
                )}
              </button>
            ) : (
              <a
                href={`/media/${item.id}`}
                className="flex aspect-[4/3] items-center justify-center rounded-xl bg-muted text-lg ring-1 ring-foreground/10 underline-offset-4 hover:underline"
              >
                Open file
              </a>
            )}
            {item.caption?.trim() ? (
              <p className="text-lg whitespace-pre-wrap">{item.caption}</p>
            ) : null}
            <p className="text-base">
              <Link
                href={`/journal/${item.meetingId}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {item.sessionLabel}
              </Link>
              <span className="text-muted-foreground"> · {item.sessionDay}</span>
            </p>
            <p className="text-base text-muted-foreground">
              — {item.uploaderName} · {item.createdLabel}
            </p>
          </li>
        ))}
      </ul>

      <Dialog.Root open={current !== null} onOpenChange={(next) => (next ? null : setOpen(null))}>
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
            {current && open !== null ? (
              <>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <p className="font-mono text-sm text-white/70">
                    {open + 1} of {items.length}
                  </p>
                  <Dialog.Close className={navButton} aria-label="Close">
                    <X className="size-6" aria-hidden />
                  </Dialog.Close>
                </div>

                <div className="flex min-h-0 flex-1 items-center justify-center gap-2 px-2 sm:gap-4 sm:px-4">
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    disabled={open === 0}
                    aria-label="Previous"
                    className={cn(navButton, "hidden sm:inline-flex")}
                  >
                    <ChevronLeft className="size-7" aria-hidden />
                  </button>
                  {/* Clicking the dark space around the photo closes, like most lightboxes. */}
                  <div
                    className="flex size-full min-w-0 items-center justify-center"
                    onClick={(event) => {
                      if (event.target === event.currentTarget) setOpen(null);
                    }}
                  >
                    {isImage(current.contentType) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={current.id}
                        src={`/media/${current.id}`}
                        alt={altFor(current)}
                        className="max-h-full max-w-full rounded-lg object-contain"
                      />
                    ) : (
                      <video
                        key={current.id}
                        src={`/media/${current.id}`}
                        controls
                        autoPlay
                        playsInline
                        aria-label={altFor(current)}
                        className="max-h-full max-w-full rounded-lg bg-black"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    disabled={open === items.length - 1}
                    aria-label="Next"
                    className={cn(navButton, "hidden sm:inline-flex")}
                  >
                    <ChevronRight className="size-7" aria-hidden />
                  </button>
                </div>

                <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-4 pt-3 pb-5 text-center">
                  <Dialog.Title className={current.caption?.trim() ? "text-lg whitespace-pre-wrap" : "sr-only"}>
                    {altFor(current)}
                  </Dialog.Title>
                  <Dialog.Description className="text-base text-white/75">
                    <Link
                      href={`/journal/${current.meetingId}`}
                      className="font-medium text-white underline-offset-4 hover:underline"
                    >
                      {current.sessionLabel}
                    </Link>
                    {" · "}
                    {current.sessionDay} · {current.uploaderName}
                  </Dialog.Description>
                  {/* Phones: swipe, or use these. */}
                  <div className="mt-2 flex justify-center gap-6 sm:hidden">
                    <button
                      type="button"
                      onClick={() => step(-1)}
                      disabled={open === 0}
                      aria-label="Previous"
                      className={navButton}
                    >
                      <ChevronLeft className="size-7" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => step(1)}
                      disabled={open === items.length - 1}
                      aria-label="Next"
                      className={navButton}
                    >
                      <ChevronRight className="size-7" aria-hidden />
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
