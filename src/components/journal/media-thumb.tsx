import { Play } from "lucide-react";
import { cn } from "cn";

import { LazyVideo } from "@/components/lazy-video";

export function isImage(contentType: string) {
  return contentType.startsWith("image/");
}

export function isVideo(contentType: string) {
  return contentType.startsWith("video/");
}

/**
 * A photo or video from the auth-gated /media route. With `onOpen` the tile is a button that
 * opens the lightbox; without it, videos load only after a tap and play in place. Video tiles
 * never create a <video> until played: iOS Safari struggles with many of them on one page.
 */
export function MediaThumb({
  id,
  contentType,
  caption,
  className,
  onOpen,
}: {
  id: string;
  contentType: string;
  caption: string | null;
  className?: string;
  onOpen?: () => void;
}) {
  const box = cn("overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10", className);
  const label = caption?.trim() || (isVideo(contentType) ? "Team video" : "Team photo");

  if (onOpen && (isImage(contentType) || isVideo(contentType))) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={`View larger: ${label}`}
        className={cn(
          box,
          "group relative block w-full focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none",
          isVideo(contentType) && "bg-black",
        )}
      >
        {isImage(contentType) ? (
          // Auth-gated app route; not a public CDN URL.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/media/${id}`}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex size-full items-center justify-center">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-white/25 ring-1 ring-white/50 transition-transform group-hover:scale-110">
              <Play className="ml-0.5 size-6 fill-white text-white" aria-hidden />
            </span>
          </span>
        )}
      </button>
    );
  }

  if (isImage(contentType)) {
    return (
      <div className={box}>
        {/* Auth-gated app route; not a public CDN URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/media/${id}`}
          alt={label}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      </div>
    );
  }
  if (isVideo(contentType)) {
    return (
      <div className={cn(box, "relative bg-black")}>
        <LazyVideo src={`/media/${id}`} label={label} className="size-full" />
      </div>
    );
  }
  return (
    <a href={`/media/${id}`} className={cn(box, "flex items-center justify-center text-base underline")}>
      Open file
    </a>
  );
}
