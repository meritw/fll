"use client";

import { useState } from "react";
import { cn } from "cn";

import { MediaThumb } from "@/components/journal/media-thumb";
import { MediaLightbox, type LightboxItem } from "@/components/media-lightbox";

/**
 * A grid of photo/video tiles that open in the lightbox, where you can step through
 * every item in `items`, including any beyond `visibleCount` behind the "+N more" tile.
 */
export function MediaGroup({
  items,
  visibleCount,
  showCaptions = false,
  className,
  thumbClassName = "aspect-[4/3]",
}: {
  items: LightboxItem[];
  visibleCount?: number;
  showCaptions?: boolean;
  className?: string;
  thumbClassName?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const shown = visibleCount != null ? items.slice(0, visibleCount) : items;
  const more = items.length - shown.length;

  return (
    <>
      <ul className={className}>
        {shown.map((item, index) => (
          <li key={item.id} className="flex flex-col gap-1">
            <MediaThumb
              id={item.id}
              contentType={item.contentType}
              caption={item.caption}
              className={thumbClassName}
              onOpen={() => setOpen(index)}
            />
            {showCaptions && item.caption?.trim() ? (
              <span className="text-sm">{item.caption}</span>
            ) : null}
          </li>
        ))}
        {more > 0 ? (
          <li>
            <button
              type="button"
              onClick={() => setOpen(shown.length)}
              className={cn(
                "flex w-full items-center justify-center rounded-xl bg-muted text-base font-semibold ring-1 ring-line hover:bg-foreground/10",
                thumbClassName,
              )}
            >
              +{more} more
            </button>
          </li>
        ) : null}
      </ul>
      <MediaLightbox items={items} index={open} onIndexChange={setOpen} />
    </>
  );
}
