"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveMeetingMedia } from "@/lib/actions";

const fieldClass = "h-12 px-3 text-lg md:text-lg";

const ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm,.jpg,.jpeg,.png,.webp,.heic,.heif,.mp4,.mov,.webm";

const MAX_BYTES = 512 * 1024 * 1024;

const EXT_TO_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

export type MediaPreviewItem = {
  id: string;
  contentType: string;
  caption: string | null;
  uploaderName: string;
  createdLabel: string;
};

function resolveContentType(file: File) {
  if (file.type && Object.values(EXT_TO_TYPE).includes(file.type)) {
    return file.type;
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_TYPE[ext] ?? "";
}

function isImage(contentType: string) {
  return contentType.startsWith("image/");
}

function isVideo(contentType: string) {
  return contentType.startsWith("video/");
}

export function MeetingMediaSection({
  meetingId,
  items,
}: {
  meetingId: string;
  items: MediaPreviewItem[];
}) {
  const router = useRouter();
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);

    try {
      const form = event.currentTarget;
      const fileInput = form.elements.namedItem("file");
      const file = fileInput instanceof HTMLInputElement ? fileInput.files?.[0] : undefined;
      if (!file) {
        setError("Choose a photo or video.");
        return;
      }
      if (file.size <= 0 || file.size > MAX_BYTES) {
        setError("That file is too large (512 MB max).");
        return;
      }

      const contentType = resolveContentType(file);
      if (!contentType) {
        setError("Use a photo (JPEG, PNG, WebP, HEIC) or video (MP4, MOV, WebM).");
        return;
      }

      const ticketResponse = await fetch("/api/storage/media/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId,
          fileName: file.name,
          size: file.size,
          contentType,
        }),
      });
      const ticket = (await ticketResponse.json().catch(() => null)) as {
        url?: string;
        key?: string;
        contentType?: string;
        error?: string;
      } | null;
      if (!ticketResponse.ok || !ticket?.url || !ticket.key || !ticket.contentType) {
        setError(
          ticket?.error ??
            (ticketResponse.status === 401 || ticketResponse.status === 403
              ? "Sign in first."
              : "The file did not upload. Try again."),
        );
        return;
      }

      const put = await fetch(ticket.url, {
        method: "PUT",
        headers: { "Content-Type": ticket.contentType },
        body: file,
      });
      if (!put.ok) {
        setError("The file did not upload. Try again. If this keeps happening, ask a coach.");
        return;
      }

      const result = await saveMeetingMedia({
        meetingId,
        objectKey: ticket.key,
        contentType: ticket.contentType,
        size: file.size,
        fileName: file.name,
        caption,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }

      setCaption("");
      form.reset();
      setMessage("message" in result ? result.message ?? "Added." : "Added.");
      router.refresh();
    } catch {
      setError("The file did not upload. Try again. If this keeps happening, ask a coach.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-semibold">Photos &amp; videos</h2>
        <p className="text-muted-foreground">Attach to this session (512 MB max).</p>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground">Nothing here yet. Add a photo or video below.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-2">
              <div className="overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
                {isImage(item.contentType) ? (
                  // Auth-gated app route; not a public CDN URL.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/media/${item.id}`}
                    alt={item.caption?.trim() || "Session photo"}
                    className="max-h-80 w-full object-contain bg-black/5"
                  />
                ) : isVideo(item.contentType) ? (
                  <video
                    src={`/media/${item.id}`}
                    controls
                    preload="metadata"
                    className="max-h-80 w-full bg-black"
                  />
                ) : (
                  <a
                    href={`/media/${item.id}`}
                    className="block px-4 py-8 text-center text-lg underline-offset-4 hover:underline"
                  >
                    Open file
                  </a>
                )}
              </div>
              {item.caption?.trim() ? (
                <p className="text-lg whitespace-pre-wrap">{item.caption}</p>
              ) : null}
              <p className="text-base text-muted-foreground">
                — {item.uploaderName} · {item.createdLabel}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="meeting-media-file" className="text-base">
            Photo or video
          </Label>
          <Input
            id="meeting-media-file"
            name="file"
            type="file"
            accept={ACCEPT}
            required
            className={`${fieldClass} py-2`}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="meeting-media-caption" className="text-base">
            Caption (optional)
          </Label>
          <Input
            id="meeting-media-caption"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            maxLength={300}
            placeholder="What is this from?"
            className={fieldClass}
          />
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription className="text-base">{error}</AlertDescription>
          </Alert>
        ) : null}
        {message ? (
          <Alert>
            <AlertDescription className="text-base">{message}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" size="xl" disabled={pending} className="self-start">
          {pending ? "Uploading…" : "Add to session"}
        </Button>
      </form>
    </section>
  );
}
