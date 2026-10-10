"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Camera, Check, CircleAlert, Play, X } from "lucide-react";
import { cn } from "cn";

import type { Viewer } from "@/components/journal/day-tabs";
import { SaveStatus, type SaveState } from "@/components/journal/save-status";
import { useDraft } from "@/components/journal/use-draft";
import {
  HOME_UPLOAD_SCOPE,
  MEDIA_ACCEPT,
  resolveContentType,
  uploadMeetingMedia,
} from "@/components/journal/upload-media";
import { Button } from "@/components/ui/button";
import { postDayNote } from "@/lib/actions";
import type { DayNoteKind } from "@/lib/notebook";

const KINDS: { kind: DayNoteKind; label: string; hint: string; placeholder: string }[] = [
  {
    kind: "progress",
    label: "Today's progress",
    hint: "What we built or got working",
    placeholder: "Today we got the arm to…",
  },
  {
    kind: "lesson",
    label: "Lesson learned",
    hint: "Something we figured out",
    placeholder: "We learned that…",
  },
  {
    kind: "action",
    label: "Next time",
    hint: "A to-do for the next meeting",
    placeholder: "Next time we need to…",
  },
  {
    kind: "other",
    label: "Other",
    hint: "Ideas, research, team stuff",
    placeholder: "Anything else the team should remember…",
  },
];

type QueuedFile = {
  key: string;
  file: File;
  previewUrl: string;
  isVideo: boolean;
  progress: number;
  state: "queued" | "uploading" | "done" | "error";
  error?: string;
};

/** Typed notes keep a Save button (team members expect one) plus a local draft so nothing is lost. */
export function NoteTab({
  meetingId,
  isToday,
  viewer,
  onSaved,
}: {
  meetingId: string | null;
  isToday: boolean;
  viewer: Viewer;
  onSaved: (meetingId: string | undefined) => void;
}) {
  const writer = viewer.role === "student" || viewer.role === "coach";
  const [kind, setKind] = useState<DayNoteKind>(writer ? "progress" : "other");
  const [fromHome, setFromHome] = useState(false);
  const [milestone, setMilestone] = useState(false);
  const draftKey = `draft:note:${fromHome ? "home" : meetingId ?? "today"}`;
  const [body, setBody, clearBody] = useDraft(draftKey);
  const [save, setSave] = useState<SaveState>(null);
  const [pending, setPending] = useState(false);
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const current = KINDS.find((item) => item.kind === kind) ?? KINDS[0];

  useEffect(
    () => () => {
      for (const item of files) URL.revokeObjectURL(item.previewUrl);
    },
    // Only on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function queueFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = [...(event.target.files ?? [])];
    event.target.value = "";
    if (picked.length === 0) return;
    setFiles((list) => [
      ...list,
      ...picked.map((file) => ({
        key: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        isVideo: resolveContentType(file).startsWith("video/"),
        progress: 0,
        state: "queued" as const,
      })),
    ]);
  }

  function removeFile(key: string) {
    setFiles((list) => {
      const target = list.find((item) => item.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return list.filter((item) => item.key !== key);
    });
  }

  function patchFile(key: string, next: Partial<QueuedFile>) {
    setFiles((list) => list.map((item) => (item.key === key ? { ...item, ...next } : item)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await postDayNote({
        meetingId: fromHome ? "home" : meetingId,
        kind,
        body,
        milestone: writer && milestone,
      });
      if ("error" in result) {
        setSave({ kind: "error", text: result.error });
        return;
      }

      const pendingFiles = files.filter((item) => item.state === "queued" || item.state === "error");
      if (fromHome && pendingFiles.length > 0) {
        if (!result.journalEntryId) {
          setSave({
            kind: "error",
            text: "Note saved, but photos need a note id. Try the Photos tab with “from home”.",
          });
          clearBody();
          setMilestone(false);
          onSaved(undefined);
          return;
        }
        let failed = 0;
        for (const item of pendingFiles) {
          patchFile(item.key, { state: "uploading", progress: 0, error: undefined });
          try {
            const uploaded = await uploadMeetingMedia(
              HOME_UPLOAD_SCOPE,
              item.file,
              (fraction) => patchFile(item.key, { progress: fraction }),
              { journalEntryId: result.journalEntryId },
            );
            if ("error" in uploaded) {
              failed += 1;
              patchFile(item.key, { state: "error", error: uploaded.error });
            } else {
              patchFile(item.key, { state: "done", progress: 1 });
            }
          } catch {
            failed += 1;
            patchFile(item.key, { state: "error", error: "The file did not upload. Try again." });
          }
        }
        if (failed > 0) {
          setSave({
            kind: "error",
            text: `Note saved. ${failed} file${failed === 1 ? "" : "s"} did not upload — try again or use Photos.`,
          });
          clearBody();
          setMilestone(false);
          onSaved(undefined);
          return;
        }
        for (const item of files) URL.revokeObjectURL(item.previewUrl);
        setFiles([]);
      }

      clearBody();
      setMilestone(false);
      setSave({ kind: "saved", text: result.message });
      onSaved(fromHome ? undefined : result.meetingId);
    } catch {
      setSave({ kind: "error", text: "That didn't save. Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-line sm:p-6"
    >
      <h2 className="text-2xl font-bold">Write a note</h2>

      {writer ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">What kind of note?</legend>
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            {KINDS.map((item) => {
              const on = item.kind === kind;
              return (
                <button
                  key={item.kind}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setKind(item.kind)}
                  className={cn(
                    "flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-2xl px-4 py-2 text-left",
                    on ? "bg-brand-soft ring-2 ring-primary" : "bg-card ring-1 ring-line hover:bg-muted",
                  )}
                >
                  <span className="text-lg font-semibold">{item.label}</span>
                  <span className="text-sm text-muted-foreground">{item.hint}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="day-note" className="font-semibold">
          Your note
        </label>
        <textarea
          id="day-note"
          rows={6}
          required
          maxLength={4000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={current.placeholder}
          className="min-h-40 rounded-xl border border-input bg-card px-3 py-3 text-lg outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {writer ? (
        <label className="flex min-h-11 items-center gap-3 text-base">
          <input
            type="checkbox"
            checked={milestone}
            onChange={(event) => setMilestone(event.target.checked)}
            className="size-5 accent-primary"
          />
          This is a big moment. Make it a milestone on the timeline.
        </label>
      ) : null}

      {isToday || fromHome ? (
        <label className="flex min-h-11 items-center gap-3 text-base">
          <input
            type="checkbox"
            checked={fromHome}
            onChange={(event) => {
              const checked = event.target.checked;
              setFromHome(checked);
              if (!checked) {
                for (const item of files) URL.revokeObjectURL(item.previewUrl);
                setFiles([]);
              }
            }}
            className="size-5 accent-primary"
          />
          I&apos;m writing this from home, not at a meeting.
        </label>
      ) : null}

      {fromHome ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-info-soft/60 p-4 ring-1 ring-info/25">
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold text-info-ink">Photos or video with this note</span>
            <span className="text-sm text-info-ink/80">
              Optional. They save with the note and show on the timeline and gallery.
            </span>
          </div>
          <label className="flex min-h-20 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-info/40 bg-card px-4 py-3 text-info-ink focus-within:ring-3 focus-within:ring-ring/50 hover:bg-info-tint/40">
            <Camera className="size-6 shrink-0" strokeWidth={1.8} aria-hidden />
            <span className="text-base font-semibold">Choose photos or videos</span>
            <input
              type="file"
              multiple
              accept={MEDIA_ACCEPT}
              onChange={queueFiles}
              className="sr-only"
            />
          </label>
          {files.length > 0 ? (
            <ul className="flex flex-col gap-2" aria-label="Files to attach">
              {files.map((item) => (
                <li key={item.key} className="flex items-center gap-3">
                  <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.isVideo ? (
                      <span className="flex size-full items-center justify-center bg-black">
                        <Play className="size-5 fill-white text-white" aria-hidden />
                      </span>
                    ) : (
                      // Local preview before upload.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.previewUrl} alt="" className="size-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    {item.state === "uploading" ? (
                      <span className="font-semibold text-info-ink">
                        Uploading… {Math.round(item.progress * 100)}%
                      </span>
                    ) : item.state === "error" ? (
                      <span className="flex items-center gap-1 font-semibold text-destructive">
                        <CircleAlert className="size-4 shrink-0" aria-hidden />
                        {item.error}
                      </span>
                    ) : item.state === "done" ? (
                      <span className="flex items-center gap-1 font-semibold text-present-ink">
                        <Check className="size-4" strokeWidth={2.5} aria-hidden />
                        Attached
                      </span>
                    ) : (
                      <span className="truncate text-foreground/80">{item.file.name}</span>
                    )}
                  </div>
                  {item.state === "queued" || item.state === "error" ? (
                    <button
                      type="button"
                      onClick={() => removeFile(item.key)}
                      aria-label={`Remove ${item.file.name}`}
                      className="inline-flex size-10 items-center justify-center rounded-lg bg-muted hover:bg-foreground/10"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Check className="mt-0.5 size-4 shrink-0 text-present" strokeWidth={2.5} aria-hidden />
        Draft kept as you type, so it won&apos;t get lost. Tap Save to add it to the journal.
        Written by {viewer.name}.
      </p>

      {save ? <SaveStatus state={save} /> : null}

      <div className="flex gap-3">
        <Button type="submit" size="xl" disabled={pending || !body.trim()} className="h-14 flex-1 text-xl">
          {pending ? "Saving…" : "Save note"}
        </Button>
        <Link
          href="/journal"
          className="inline-flex h-14 items-center justify-center rounded-lg bg-muted px-6 text-lg font-medium hover:bg-foreground/10"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
