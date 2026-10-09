"use client";

import { useState } from "react";
import Link from "next/link";

import { MediaThumb } from "@/components/journal/media-thumb";
import { MediaLightbox } from "@/components/media-lightbox";

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

export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <p className="text-lg text-muted-foreground">
        No photos or videos yet. Add them from a meeting session page.
      </p>
    );
  }

  return (
    <>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <li key={item.id} className="flex flex-col gap-2">
            <MediaThumb
              id={item.id}
              contentType={item.contentType}
              caption={item.caption}
              className="aspect-[4/3]"
              onOpen={() => setOpen(index)}
            />
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

      <MediaLightbox
        index={open}
        onIndexChange={setOpen}
        items={items.map((item) => ({
          id: item.id,
          contentType: item.contentType,
          caption: item.caption,
          fallbackLabel: `${item.sessionLabel} · ${item.sessionDay}`,
          detail: `${item.sessionDay} · ${item.uploaderName}`,
          link: { href: `/journal/${item.meetingId}`, label: item.sessionLabel },
        }))}
      />
    </>
  );
}
