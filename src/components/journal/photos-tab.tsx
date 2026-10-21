"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Camera, Check, CircleAlert, Play } from "lucide-react";

import type { Viewer } from "@/components/journal/day-tabs";
import { MediaThumb } from "@/components/journal/media-thumb";
import { MediaLightbox } from "@/components/media-lightbox";
import { SaveStatus, type SaveState } from "@/components/journal/save-status";
import {
  HOME_UPLOAD_SCOPE,
  MEDIA_ACCEPT,
  resolveContentType,
  uploadMeetingMedia,
} from "@/components/journal/upload-media";
import { saveMediaCaption } from "@/lib/actions";

export type ExistingMedia = {
  id: string;
  contentType: string;
  caption: string | null;
  uploaderId: string;
  uploaderName: string;
};

type Upload = {
  key: string;
  name: string;
  previewUrl: string;
  isVideo: boolean;
  progress: number;
  state: "uploading" | "done" | "error";
  error?: string;
  mediaId?: string;
};

/** Photos and videos save as soon as they finish uploading; captions have their own Save. */
export function PhotosTab({
  viewer,
  existing,
  isToday,
  ensureMeeting,
  onSaved,
}: {
  viewer: Viewer;
  existing: ExistingMedia[];
  isToday: boolean;
  ensureMeeting: () => Promise<string>;
  onSaved: (meetingId: string | undefined) => void;
}) {
  const [fromHome, setFromHome] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  /** Index into `earlier` shown in the lightbox, or null. */
  const [viewing, setViewing] = useState<number | null>(null);
  useEffect(
    () => () => {
      for (const item of uploads) URL.revokeObjectURL(item.previewUrl);
    },
    // Only on unmount; previews stay valid while the tab is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function patch(key: string, next: Partial<Upload>) {
    setUploads((list) => list.map((item) => (item.key === key ? { ...item, ...next } : item)));
  }

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (files.length === 0) return;

    const added: (Upload & { file: File })[] = files.map((file) => ({
      key: crypto.randomUUID(),
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      isVideo: resolveContentType(file).startsWith("video/"),
      progress: 0,
      state: "uploading",
      file,
    }));
    setUploads((list) => [
      ...added.map((item) => ({
        key: item.key,
        name: item.name,
        previewUrl: item.previewUrl,
        isVideo: item.isVideo,
        progress: item.progress,
        state: item.state,
      })),
      ...list,
    ]);

    let target: string;
    if (fromHome) {
      target = HOME_UPLOAD_SCOPE;
    } else {
      try {
        target = await ensureMeeting();
      } catch (error) {
        const text = error instanceof Error ? error.message : "That didn't save. Try again.";
        for (const item of added) patch(item.key, { state: "error", error: text });
        return;
      }
    }

    // One at a time keeps phones on slow connections from stalling.
    for (const item of added) {
      try {
        const result = await uploadMeetingMedia(target, item.file, (fraction) =>
          patch(item.key, { progress: fraction }),
        );
        if ("error" in result) {
          patch(item.key, { state: "error", error: result.error });
        } else {
          patch(item.key, { state: "done", progress: 1, mediaId: result.id });
        }
      } catch {
        patch(item.key, { state: "error", error: "The file did not upload. Try again." });
      }
    }
    onSaved(fromHome ? undefined : target);
  }

  const doneIds = new Set(uploads.map((item) => item.mediaId).filter(Boolean));
  const earlier = existing.filter((item) => !doneIds.has(item.id));

  return (
    <section
      id="photos"
      className="flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-line sm:p-6"
    >
      <h2 className="text-2xl font-bold">Add photos or video</h2>
      <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-info/40 bg-info-soft p-4 text-center text-info-ink focus-within:ring-3 focus-within:ring-ring/50 hover:bg-info-tint">
        <Camera className="size-10" strokeWidth={1.8} aria-hidden />
        <span className="text-xl font-semibold">Choose photos or videos</span>
        <span className="text-base text-info-ink/80">
          or take one now with your phone or tablet camera
        </span>
        <input
          type="file"
          multiple
          accept={MEDIA_ACCEPT}
          onChange={onPick}
          className="sr-only"
        />
      </label>

      {isToday || fromHome ? (
        <label className="flex min-h-11 items-center gap-3 text-base">
          <input
            type="checkbox"
            checked={fromHome}
            onChange={(event) => setFromHome(event.target.checked)}
            className="size-5 accent-primary"
          />
          I&apos;m adding this from home, not at a meeting.
        </label>
      ) : null}

      {uploads.length > 0 ? (
        <ul className="flex flex-col gap-3" aria-label="Your uploads">
          {uploads.map((item) => (
            <li key={item.key} className="flex items-start gap-3">
              <div className="relative h-18 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                {item.isVideo ? (
                  <span className="flex size-full items-center justify-center bg-black">
                    <Play className="size-6 fill-white text-white" aria-hidden />
                  </span>
                ) : (
                  // Local preview of the file being uploaded.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.previewUrl} alt="" className="size-full object-cover" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <UploadState item={item} />
                {item.state === "done" && item.mediaId ? (
                  <CaptionEditor mediaId={item.mediaId} initial="" inputId={`cap-${item.key}`} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-base text-foreground/80">
        {fromHome
          ? "Photos and videos from home go on the journal timeline and gallery as soon as they finish uploading. Captions are optional."
          : "Photos and videos go into the journal as soon as they finish uploading. Captions are optional. Everyone on the team can see these."}
      </p>

      {earlier.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <h3 className="text-lg font-semibold">Already on this day</h3>
          <ul className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
            {earlier.map((item, index) => {
              const canEdit = item.uploaderId === viewer.id || viewer.role === "coach";
              return (
                <li key={item.id} className="flex flex-col gap-2">
                  <MediaThumb
                    id={item.id}
                    contentType={item.contentType}
                    caption={item.caption}
                    className="aspect-[4/3]"
                    onOpen={() => setViewing(index)}
                  />
                  {canEdit ? (
                    <CaptionEditor
                      mediaId={item.id}
                      initial={item.caption ?? ""}
                      inputId={`cap-${item.id}`}
                    />
                  ) : item.caption ? (
                    <p className="text-base">{item.caption}</p>
                  ) : null}
                  <span className="text-sm text-muted-foreground">{item.uploaderName}</span>
                </li>
              );
            })}
          </ul>
          <MediaLightbox
            index={viewing}
            onIndexChange={setViewing}
            items={earlier.map((item) => ({
              id: item.id,
              contentType: item.contentType,
              caption: item.caption,
              fallbackLabel: "Photo from this day",
              detail: item.uploaderName,
            }))}
          />
        </div>
      ) : null}
    </section>
  );
}

function UploadState({ item }: { item: Upload }) {
  if (item.state === "done") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-semibold text-present-ink">
        <Check className="size-4 text-present" strokeWidth={2.5} aria-hidden />
        Added to the journal
      </span>
    );
  }
  if (item.state === "error") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
        <CircleAlert className="size-4" aria-hidden />
        {item.error}
      </span>
    );
  }
  const percent = Math.round(item.progress * 100);
  return (
    <span className="flex items-center gap-2 text-sm font-semibold text-info-ink">
      Uploading {item.isVideo ? "video" : "photo"}… {percent}%
      <span
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Uploading ${item.name}`}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-info-tint"
      >
        <span className="block h-full bg-info" style={{ width: `${percent}%` }} />
      </span>
    </span>
  );
}

function CaptionEditor({
  mediaId,
  initial,
  inputId,
}: {
  mediaId: string;
  initial: string;
  inputId: string;
}) {
  const router = useRouter();
  const [caption, setCaption] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [state, setState] = useState<SaveState>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await saveMediaCaption({ mediaId, caption });
      if ("error" in result) {
        setState({ kind: "error", text: result.error });
        return;
      }
      setSaved(caption);
      setState({ kind: "saved", text: result.message });
      router.refresh();
    } catch {
      setState({ kind: "error", text: "That didn't save. Try again." });
    } finally {
      setPending(false);
    }
  }

  const changed = caption.trim() !== saved.trim();
  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold">
        What&apos;s happening here?
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          maxLength={300}
          placeholder="The new arm grabbing the piece"
          className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button
          type="submit"
          disabled={pending || !changed}
          className="h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {state && !changed ? <SaveStatus state={state} /> : null}
    </form>
  );
}
