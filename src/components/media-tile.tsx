"use client";

import { Play } from "lucide-react";
import { useRef, useState } from "react";

import { isImageType, isVideoType } from "@/lib/media-types";
import { cn } from "@/lib/utils";

/** One photo or video thumbnail. Videos start playing in place when tapped. */
export function MediaTile({
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
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const label = caption?.trim() || "Journal photo";

  if (isImageType(contentType)) {
    return (
      <a
        href={`/media/${id}`}
        target="_blank"
        rel="noreferrer"
        className={cn("block overflow-hidden rounded-xl bg-muted ring-1 ring-line", className)}
      >
        {/* Auth-gated app route; not a public CDN URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/media/${id}`} alt={label} loading="lazy" className="aspect-[4/3] size-full object-cover" />
      </a>
    );
  }

  if (isVideoType(contentType)) {
    return (
      <div className={cn("relative overflow-hidden rounded-xl bg-black ring-1 ring-line", className)}>
        <video
          ref={videoRef}
          src={`/media/${id}`}
          controls={playing}
          playsInline
          preload="metadata"
          aria-label={label}
          className="aspect-[4/3] size-full bg-black object-cover"
        />
        {playing ? null : (
          <button
            type="button"
            aria-label={`Play video: ${label}`}
            onClick={() => {
              setPlaying(true);
              void videoRef.current?.play();
            }}
            className="absolute inset-0 flex items-center justify-center bg-black/25"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-white/90 text-primary-dark">
              <Play className="size-6 fill-current" />
            </span>
          </button>
        )}
      </div>
    );
  }

  return (
    <a
      href={`/media/${id}`}
      className={cn(
        "flex aspect-[4/3] items-center justify-center rounded-xl bg-muted ring-1 ring-line",
        className,
      )}
    >
      Open file
    </a>
  );
}
