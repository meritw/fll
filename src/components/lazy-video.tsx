"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { cn } from "cn";

/**
 * iOS Safari (and low-memory phones) choke when many <video> tags exist with
 * preload="metadata" — each one opens a network request and decoder work.
 * Keep a light placeholder until the user asks to play.
 */
export function LazyVideo({
  src,
  className,
  label,
}: {
  src: string;
  className?: string;
  label?: string;
}) {
  const [active, setActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const aria = label?.trim() || "Play video";

  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => {
      // Autoplay after tap can still be blocked; controls remain.
    });
  }, [active]);

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        aria-label={aria}
        className={cn(
          "relative flex size-full items-center justify-center bg-black text-white",
          className,
        )}
      >
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-white/25 ring-1 ring-white/50">
          <Play className="size-7 fill-white text-white" aria-hidden />
        </span>
      </button>
    );
  }

  return (
    <video
      ref={videoRef}
      src={src}
      controls
      playsInline
      preload="metadata"
      aria-label={aria}
      className={cn("size-full bg-black object-contain", className)}
    />
  );
}
