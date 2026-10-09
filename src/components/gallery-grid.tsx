import Link from "next/link";

import { LazyVideo } from "@/components/lazy-video";

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

export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-lg text-muted-foreground">
        No photos or videos yet. Add them from a meeting session page.
      </p>
    );
  }

  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-2 [content-visibility:auto] [contain-intrinsic-size:auto_320px]">
          <div className="overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
            {isImage(item.contentType) ? (
              // Auth-gated app route; not a public CDN URL.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/media/${item.id}`}
                alt={item.caption?.trim() || item.sessionLabel}
                loading="lazy"
                decoding="async"
                className="aspect-[4/3] w-full object-cover"
              />
            ) : isVideo(item.contentType) ? (
              <div className="aspect-[4/3] w-full">
                <LazyVideo
                  src={`/media/${item.id}`}
                  label={item.caption?.trim() || item.sessionLabel}
                  className="aspect-[4/3] w-full"
                />
              </div>
            ) : (
              <a
                href={`/media/${item.id}`}
                className="flex aspect-[4/3] items-center justify-center text-lg underline-offset-4 hover:underline"
              >
                Open file
              </a>
            )}
          </div>
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
  );
}
