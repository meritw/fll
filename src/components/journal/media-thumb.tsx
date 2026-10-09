import { Play } from "lucide-react";
import { cn } from "cn";

export function isImage(contentType: string) {
  return contentType.startsWith("image/");
}

export function isVideo(contentType: string) {
  return contentType.startsWith("video/");
}

/**
 * A photo or video from the auth-gated /media route. With `onOpen` the tile is a button
 * (videos show a still and a play badge) that opens the lightbox; without it, videos play in place.
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
        )}
      >
        {isImage(contentType) ? (
          // Auth-gated app route; not a public CDN URL.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/media/${id}`}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <>
            {/* #t= nudges iOS to paint the first frame as a preview. */}
            <video
              src={`/media/${id}#t=0.1`}
              muted
              playsInline
              preload="metadata"
              className="size-full bg-black object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-black/55 text-white transition-transform group-hover:scale-110">
                <Play className="ml-0.5 size-5 fill-white" aria-hidden />
              </span>
            </span>
          </>
        )}
      </button>
    );
  }

  if (isImage(contentType)) {
    return (
      <div className={box}>
        {/* Auth-gated app route; not a public CDN URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/media/${id}`} alt={label} loading="lazy" className="size-full object-cover" />
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
          aria-label={label}
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
