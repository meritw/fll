import { Play } from "lucide-react";
import { cn } from "cn";

export function isImage(contentType: string) {
  return contentType.startsWith("image/");
}

export function isVideo(contentType: string) {
  return contentType.startsWith("video/");
}

/** A photo or video from the auth-gated /media route. Videos play in place. */
export function MediaThumb({
  id,
  contentType,
  caption,
  className,
}: {
  id: string;
  contentType: string;
  caption: string | null;
  className?: string;
}) {
  const box = cn("overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10", className);
  if (isImage(contentType)) {
    return (
      <div className={box}>
        {/* Auth-gated app route; not a public CDN URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/media/${id}`}
          alt={caption?.trim() || "Team photo"}
          loading="lazy"
          className="size-full object-cover"
        />
      </div>
    );
  }
  if (isVideo(contentType)) {
    return (
      <div className={cn(box, "relative bg-black")}>
        <video
          src={`/media/${id}`}
          controls
          playsInline
          preload="metadata"
          aria-label={caption?.trim() || "Team video"}
          className="size-full object-contain"
        />
        <Play
          className="pointer-events-none absolute top-2 left-2 size-5 fill-white text-white drop-shadow"
          aria-hidden
        />
      </div>
    );
  }
  return (
    <a href={`/media/${id}`} className={cn(box, "flex items-center justify-center text-base underline")}>
      Open file
    </a>
  );
}
