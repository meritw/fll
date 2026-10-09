"use client";

import {
  Bot,
  Camera,
  CircleCheck,
  Pencil,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { MediaTile } from "@/components/media-tile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDraft } from "@/hooks/use-draft";
import {
  ensureTodayMeetingId,
  postDayNote,
  postMissionNote,
  saveMeetingMedia,
  setMissionStatusAction,
  toggleAttendance,
  updateMediaCaptionAction,
} from "@/lib/actions";
import {
  JOURNAL_TAB_LABELS,
  tabsFor,
  type JournalTab,
} from "@/lib/journal-tabs";
import {
  isImageType,
  MEDIA_ACCEPT,
  MEDIA_MAX_BYTES,
  resolveMediaContentType,
} from "@/lib/media-types";
import {
  MISSION_STATUS_LABELS,
  MISSION_STATUSES,
  missionCode,
  type MissionStatus,
} from "@/lib/mission-status";
import { STATUS_CLASSES } from "@/components/status-pill";
import { cn } from "@/lib/utils";

const SAVE_ERROR = "That didn't save. Try again.";

export type EditorMedia = {
  id: string;
  contentType: string;
  caption: string | null;
  uploaderName: string;
  uploaderId: string;
};

export type EditorMeeting = {
  id: string;
  attendeeIds: string[];
  media: EditorMedia[];
};

export type EditorMission = {
  id: number;
  number: number;
  name: string;
  status: MissionStatus;
};

export type JournalDayEditorProps = {
  meeting: EditorMeeting | null;
  heading: string;
  isToday: boolean;
  students: { id: string; name: string }[];
  missions: EditorMission[];
  assignedMissionIds: number[];
  recentMeetings: { id: string; label: string }[];
  todayMeetingId: string | null;
  user: { id: string; name: string; role: string };
  initialTab: JournalTab;
};

type Status = { tone: "ok" | "error"; lead: string; text: string };

function StatusLine({ status }: { status: Status | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "min-h-12 rounded-xl px-4 py-3 text-base",
        status
          ? status.tone === "ok"
            ? "bg-present-bg text-present-text"
            : "bg-destructive/10 text-destructive"
          : "",
      )}
    >
      {status ? (
        <>
          <strong>{status.lead}</strong> {status.text}
        </>
      ) : null}
    </div>
  );
}

function BackToJournal() {
  return (
    <Link
      href="/journal"
      className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-card px-5 text-lg font-semibold hover:border-primary"
    >
      Back to the journal
    </Link>
  );
}

type NoteKind = "progress" | "lesson" | "action" | "other";

const NOTE_KINDS: {
  key: NoteKind;
  title: string;
  hint: string;
  placeholder: string;
}[] = [
  {
    key: "progress",
    title: "Today's progress",
    hint: "What we built or got working",
    placeholder: "Today we got the arm to…",
  },
  {
    key: "lesson",
    title: "Lesson learned",
    hint: "Something we figured out",
    placeholder: "We learned that…",
  },
  {
    key: "action",
    title: "Next time",
    hint: "A to-do for the next meeting",
    placeholder: "Next time we need to…",
  },
  {
    key: "other",
    title: "Other",
    hint: "Ideas, research, team stuff",
    placeholder: "Anything else the team should remember…",
  },
];

export function JournalDayEditor({
  meeting,
  heading,
  isToday,
  students,
  missions,
  assignedMissionIds,
  recentMeetings,
  todayMeetingId,
  user,
  initialTab,
}: JournalDayEditorProps) {
  const router = useRouter();
  const parent = user.role === "parent";
  const coach = user.role === "coach";
  const [tab, setTab] = useState<JournalTab>(initialTab);
  const [homeMode, setHomeMode] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const meetingPromise = useRef<Promise<string> | null>(null);

  const tabs = homeMode ? (["note"] as JournalTab[]) : tabsFor(parent);
  const activeTab = tabs.includes(tab) ? tab : tabs[0];
  const meetingKey = homeMode ? "home" : (meeting?.id ?? "today");

  async function resolveMeeting(): Promise<string> {
    if (meeting) {
      return meeting.id;
    }
    if (!meetingPromise.current) {
      meetingPromise.current = ensureTodayMeetingId().then((result) => {
        if ("error" in result) {
          meetingPromise.current = null;
          throw new Error(result.error);
        }
        return result.id;
      });
    }
    return meetingPromise.current;
  }

  function changeTab(next: JournalTab) {
    setTab(next);
    setStatus(null);
  }

  function onDayChange(value: string) {
    if (value === "home") {
      setHomeMode(true);
      setTab("note");
      setStatus(null);
      return;
    }
    setHomeMode(false);
    if (value === "new") {
      if (meeting) {
        router.push(`/journal/today?tab=${activeTab}`);
      }
      return;
    }
    if (value !== meeting?.id) {
      router.push(`/journal/${value}?tab=${activeTab}`);
    }
  }

  const selectValue = homeMode ? "home" : (meeting?.id ?? "new");
  const options = [...recentMeetings];
  if (meeting && !options.some((option) => option.id === meeting.id)) {
    options.unshift({ id: meeting.id, label: heading });
  }

  return (
    <section
      aria-label="Add to the journal"
      className="flex flex-col gap-6 rounded-2xl border border-line bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-mono text-sm tracking-widest text-primary uppercase">Adding to</p>
          <h1 className="text-2xl font-bold sm:text-3xl">
            {homeMode ? "Notes from home" : heading}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="different-day" className="text-base text-ink-muted">
              Different day?
            </Label>
            <select
              id="different-day"
              value={selectValue}
              onChange={(event) => onDayChange(event.target.value)}
              className="h-11 max-w-56 rounded-xl border border-line bg-card px-3 text-base"
            >
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
              {!todayMeetingId && !parent ? (
                <option value="new">Start a new meeting today</option>
              ) : null}
              <option value="home">Not at a meeting (from home)</option>
            </select>
          </div>
          <Link
            href="/journal"
            aria-label="Close and go back to the journal"
            className="flex size-11 items-center justify-center rounded-xl border border-line hover:border-primary"
          >
            <X className="size-5" aria-hidden />
          </Link>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="What do you want to add?"
        className={cn("grid gap-2", tabs.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-4")}
        style={tabs.length < 4 && tabs.length > 1 ? { gridTemplateColumns: `repeat(${tabs.length}, 1fr)` } : undefined}
      >
        {tabs.map((key, index) => {
          const selected = activeTab === key;
          const Icon = { attend: CircleCheck, note: Pencil, media: Camera, robot: Bot }[key];
          return (
            <button
              key={key}
              id={`tab-${key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => changeTab(key)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                  const delta = event.key === "ArrowRight" ? 1 : -1;
                  const next = tabs[(index + delta + tabs.length) % tabs.length];
                  changeTab(next);
                  document.getElementById(`tab-${next}`)?.focus();
                }
              }}
              className={cn(
                "flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 px-3 text-lg font-semibold transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-line bg-card hover:border-primary",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {JOURNAL_TAB_LABELS[key]}
            </button>
          );
        })}
      </div>

      <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {activeTab === "attend" ? (
          <AttendanceTab
            meeting={meeting}
            isToday={isToday}
            students={students}
            resolveMeeting={resolveMeeting}
            status={status}
            setStatus={setStatus}
          />
        ) : null}
        {activeTab === "note" ? (
          <NoteTab
            meeting={meeting}
            homeMode={homeMode}
            meetingKey={meetingKey}
            parent={parent}
            userName={user.name}
            status={status}
            setStatus={setStatus}
          />
        ) : null}
        {activeTab === "media" ? (
          <PhotosTab
            meeting={meeting}
            parent={parent}
            coach={coach}
            userId={user.id}
            resolveMeeting={resolveMeeting}
            status={status}
            setStatus={setStatus}
          />
        ) : null}
        {activeTab === "robot" ? (
          <RobotTab
            meeting={meeting}
            meetingKey={meetingKey}
            missions={missions}
            assignedMissionIds={assignedMissionIds}
            resolveMeeting={resolveMeeting}
            status={status}
            setStatus={setStatus}
          />
        ) : null}
      </div>
    </section>
  );
}

type TabCommon = {
  status: Status | null;
  setStatus: (status: Status | null) => void;
};

function AttendanceTab({
  meeting,
  isToday,
  students,
  resolveMeeting,
  status,
  setStatus,
}: TabCommon & {
  meeting: EditorMeeting | null;
  isToday: boolean;
  students: { id: string; name: string }[];
  resolveMeeting: () => Promise<string>;
}) {
  const router = useRouter();
  const [present, setPresent] = useState(() => new Set(meeting?.attendeeIds ?? []));

  function mark(id: string, value: boolean) {
    setPresent((previous) => {
      const next = new Set(previous);
      if (value) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  async function tap(student: { id: string; name: string }) {
    const next = !present.has(student.id);
    mark(student.id, next);
    setStatus(null);
    try {
      const meetingId = await resolveMeeting();
      const result = await toggleAttendance({
        meetingId,
        userId: student.id,
        present: next,
      });
      if ("error" in result) {
        throw new Error(result.error);
      }
      setStatus({
        tone: "ok",
        lead: "Saved.",
        text: `${result.userName} is marked ${next ? "here" : "away"}.`,
      });
      if (!meeting) {
        router.replace(`/journal/${meetingId}?tab=attend`);
      }
    } catch {
      mark(student.id, !next);
      setStatus({ tone: "error", lead: SAVE_ERROR, text: "" });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-bold">
            {isToday ? "Who's here today?" : "Who was here?"}
          </h2>
          <p className="font-mono text-base font-semibold text-present-text">
            {present.size} of {students.length} here
          </p>
        </div>
        <p className="text-ink-muted">
          Tap your name when you arrive. It saves right away. Tap again if you made a mistake.
        </p>
      </div>

      {students.length === 0 ? (
        <p className="text-ink-muted">No students have been added yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {students.map((student) => {
            const here = present.has(student.id);
            return (
              <li key={student.id}>
                <button
                  type="button"
                  aria-pressed={here}
                  onClick={() => void tap(student)}
                  className={cn(
                    "flex min-h-[60px] w-full items-center gap-3 rounded-xl border-2 px-4 text-left text-[19px] font-semibold transition-colors",
                    here
                      ? "border-present bg-present-bg text-present-text"
                      : "border-line bg-card hover:border-present/60",
                  )}
                >
                  {here ? (
                    <CircleCheck className="size-7 shrink-0 text-present" aria-hidden />
                  ) : (
                    <span
                      aria-hidden
                      className="size-6 shrink-0 rounded-full border-2 border-ink-muted/50"
                    />
                  )}
                  <span className="min-w-0 truncate">{student.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <StatusLine status={status} />
      <div>
        <BackToJournal />
      </div>
    </div>
  );
}

function NoteTab({
  meeting,
  homeMode,
  meetingKey,
  parent,
  userName,
  status,
  setStatus,
}: TabCommon & {
  meeting: EditorMeeting | null;
  homeMode: boolean;
  meetingKey: string;
  parent: boolean;
  userName: string;
}) {
  const router = useRouter();
  const kinds = parent ? NOTE_KINDS.filter((item) => item.key === "other") : NOTE_KINDS;
  const [kind, setKind] = useState<NoteKind>(parent ? "other" : "progress");
  const [milestone, setMilestone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [body, setBody, clearDraft] = useDraft(`draft:note:${meetingKey}:${kind}`);
  const current = NOTE_KINDS.find((item) => item.key === kind) ?? NOTE_KINDS[0];

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const result = await postDayNote({
        meetingId: homeMode ? "home" : (meeting?.id ?? null),
        kind,
        body,
        milestone,
      });
      if ("error" in result) {
        setStatus({ tone: "error", lead: result.error ?? SAVE_ERROR, text: "" });
        return;
      }
      clearDraft();
      setMilestone(false);
      setStatus({ tone: "ok", lead: "Saved.", text: "Your note is in the journal." });
      if (!meeting && !homeMode) {
        const created = await ensureTodayMeetingId();
        if ("id" in created) {
          router.replace(`/journal/${created.id}?tab=note`);
        }
      }
    } catch {
      setStatus({ tone: "error", lead: SAVE_ERROR, text: "" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="flex flex-col gap-5"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xl font-bold">What kind of note?</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kinds.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={kind === item.key}
              onClick={() => {
                setKind(item.key);
                setStatus(null);
              }}
              className={cn(
                "flex min-h-20 flex-col items-start justify-center gap-0.5 rounded-xl border-2 px-3 py-2 text-left transition-colors",
                kind === item.key
                  ? "border-primary bg-primary-tint text-primary-dark"
                  : "border-line bg-card hover:border-primary/60",
              )}
            >
              <span className="text-lg font-bold">{item.title}</span>
              <span className="text-sm text-ink-muted">{item.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="day-note-body" className="text-base font-semibold">
          Your note
        </Label>
        <Textarea
          id="day-note-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={current.placeholder}
          maxLength={4000}
          rows={5}
          className="min-h-36 rounded-xl px-3 py-2 text-lg md:text-lg"
        />
      </div>

      {parent ? null : (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base">
          <input
            type="checkbox"
            checked={milestone}
            onChange={(event) => setMilestone(event.target.checked)}
            className="size-6 accent-primary"
          />
          This is a big moment. Make it a milestone on the timeline.
        </label>
      )}

      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-present" aria-hidden />
        Draft kept as you type, so it won&apos;t get lost. Tap Save to add it to the journal.
        Written by {userName}.
      </p>

      <StatusLine status={status} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          size="xl"
          disabled={saving || !body.trim()}
          className="h-14 flex-1 rounded-xl"
        >
          {saving ? "Saving…" : "Save note"}
        </Button>
        <Link
          href="/journal"
          className="inline-flex min-h-14 items-center justify-center rounded-xl border border-line bg-card px-6 text-lg font-semibold hover:border-primary"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

type UploadRow = {
  key: string;
  name: string;
  preview: string;
  contentType: string;
  state: "waiting" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  mediaId?: string;
};

function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (fraction: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("upload failed"));
    xhr.onerror = () => reject(new Error("upload failed"));
    xhr.send(file);
  });
}

function CaptionEditor({
  mediaId,
  initial,
  canEdit,
}: {
  mediaId: string;
  initial: string | null;
  canEdit: boolean;
}) {
  const [caption, setCaption] = useState(initial ?? "");
  const [saved, setSaved] = useState<Status | null>(null);
  const [saving, setSaving] = useState(false);

  if (!canEdit) {
    return caption.trim() ? <p className="text-base whitespace-pre-wrap">{caption}</p> : null;
  }

  async function save() {
    setSaving(true);
    setSaved(null);
    try {
      const result = await updateMediaCaptionAction({ mediaId, caption });
      setSaved(
        "error" in result
          ? { tone: "error", lead: result.error ?? SAVE_ERROR, text: "" }
          : { tone: "ok", lead: "Saved.", text: "" },
      );
    } catch {
      setSaved({ tone: "error", lead: SAVE_ERROR, text: "" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <Input
          aria-label="What's happening here?"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          maxLength={300}
          placeholder="What's happening here?"
          className="h-11 flex-1 rounded-xl px-3 text-base md:text-base"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={saving}
          onClick={() => void save()}
          className="h-11 rounded-xl px-4 text-base"
        >
          Save
        </Button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={cn(
          "min-h-5 text-sm",
          saved?.tone === "error" ? "text-destructive" : "text-present-text",
        )}
      >
        {saved ? saved.lead : ""}
      </p>
    </div>
  );
}

function PhotosTab({
  meeting,
  parent,
  coach,
  userId,
  resolveMeeting,
  status,
  setStatus,
}: TabCommon & {
  meeting: EditorMeeting | null;
  parent: boolean;
  coach: boolean;
  userId: string;
  resolveMeeting: () => Promise<string>;
}) {
  const [rows, setRows] = useState<UploadRow[]>([]);
  const needsDay = parent && !meeting;

  function patch(key: string, changes: Partial<UploadRow>) {
    setRows((previous) =>
      previous.map((row) => (row.key === key ? { ...row, ...changes } : row)),
    );
  }

  async function uploadOne(file: File, key: string, contentType: string) {
    patch(key, { state: "uploading", progress: 0 });
    const meetingId = await resolveMeeting();
    if (!meeting) {
      window.history.replaceState(null, "", `/journal/${meetingId}?tab=media`);
    }

    const ticketResponse = await fetch("/api/storage/media/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId, fileName: file.name, size: file.size, contentType }),
    });
    const ticket = (await ticketResponse.json().catch(() => null)) as {
      url?: string;
      key?: string;
      contentType?: string;
      error?: string;
    } | null;
    if (!ticketResponse.ok || !ticket?.url || !ticket.key || !ticket.contentType) {
      throw new Error(
        ticket?.error ??
          (ticketResponse.status === 401 || ticketResponse.status === 403
            ? "Sign in first."
            : "The file did not upload. Try again."),
      );
    }

    await putWithProgress(ticket.url, file, ticket.contentType, (fraction) =>
      patch(key, { progress: fraction }),
    );

    const saved = await saveMeetingMedia({
      meetingId,
      objectKey: ticket.key,
      contentType: ticket.contentType,
      size: file.size,
      fileName: file.name,
    });
    if ("error" in saved && saved.error) {
      throw new Error(saved.error);
    }
    if (!("id" in saved) || !saved.id) {
      throw new Error("The file did not upload. Try again.");
    }
    patch(key, { state: "done", progress: 1, mediaId: saved.id });
  }

  async function onFiles(list: FileList | null) {
    const files = list ? Array.from(list) : [];
    if (files.length === 0) {
      return;
    }
    setStatus(null);

    const batch = files.map((file) => ({
      file,
      key: crypto.randomUUID(),
      contentType: resolveMediaContentType(file),
    }));
    setRows((previous) => [
      ...batch.map(
        (item): UploadRow => ({
          key: item.key,
          name: item.file.name,
          preview: URL.createObjectURL(item.file),
          contentType: item.contentType || item.file.type,
          state: "waiting",
          progress: 0,
        }),
      ),
      ...previous,
    ]);

    for (const item of batch) {
      if (!item.contentType) {
        patch(item.key, {
          state: "error",
          error: "Use a photo (JPEG, PNG, WebP, HEIC) or video (MP4, MOV, WebM).",
        });
        continue;
      }
      if (item.file.size <= 0 || item.file.size > MEDIA_MAX_BYTES) {
        patch(item.key, { state: "error", error: "That file is too large (512 MB max)." });
        continue;
      }
      try {
        await uploadOne(item.file, item.key, item.contentType);
      } catch (error) {
        patch(item.key, {
          state: "error",
          error: error instanceof Error && error.message ? error.message : SAVE_ERROR,
        });
      }
    }
  }

  const uploadedIds = new Set(rows.flatMap((row) => (row.mediaId ? [row.mediaId] : [])));
  const existing = (meeting?.media ?? []).filter((item) => !uploadedIds.has(item.id));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold">Add photos or videos</h2>
        <p className="text-ink-muted">
          Photos and videos go into the journal as soon as they finish uploading. Captions are
          optional. Everyone on the team can see these.
        </p>
      </div>

      {needsDay ? (
        <p className="rounded-xl bg-info-bg px-4 py-3 text-info-text">
          Pick a meeting day in &ldquo;Different day?&rdquo; above, then add your photos.
        </p>
      ) : (
        <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/60 bg-primary-tint-soft px-4 py-8 text-center focus-within:ring-3 focus-within:ring-ring/50">
          <Camera className="size-9 text-primary" aria-hidden />
          <span className="text-xl font-bold">Choose photos or videos</span>
          <span className="text-base text-ink-muted">
            or take one now with your phone or tablet camera
          </span>
          <input
            type="file"
            multiple
            accept={MEDIA_ACCEPT}
            className="sr-only"
            onChange={(event) => {
              const input = event.currentTarget;
              void onFiles(input.files).finally(() => {
                input.value = "";
              });
            }}
          />
        </label>
      )}

      {rows.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex flex-col gap-3 rounded-xl border border-line p-3 sm:flex-row"
            >
              <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                {isImageType(row.contentType) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.preview} alt="" className="size-full object-cover" />
                ) : (
                  <video
                    src={`${row.preview}#t=0.1`}
                    preload="metadata"
                    muted
                    playsInline
                    className="size-full object-cover"
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="truncate font-medium">{row.name}</p>
                {row.state === "waiting" ? <p className="text-ink-muted">Waiting…</p> : null}
                {row.state === "uploading" ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-base">
                      Uploading {isImageType(row.contentType) ? "photo" : "video"}…{" "}
                      {Math.round(row.progress * 100)}%
                    </p>
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(row.progress * 100)}
                      className="h-2 overflow-hidden rounded-full bg-status-none"
                    >
                      <div
                        className="h-full bg-primary transition-[width]"
                        style={{ width: `${Math.round(row.progress * 100)}%` }}
                      />
                    </div>
                  </div>
                ) : null}
                {row.state === "error" ? (
                  <p role="alert" className="text-base font-medium text-destructive">
                    {row.error ?? SAVE_ERROR}
                  </p>
                ) : null}
                {row.state === "done" && row.mediaId ? (
                  <>
                    <p className="flex items-center gap-1.5 text-base font-medium text-present-text">
                      <CircleCheck className="size-5" aria-hidden /> Added to the journal
                    </p>
                    <CaptionEditor mediaId={row.mediaId} initial={null} canEdit />
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <StatusLine status={status} />

      {existing.length > 0 ? (
        <section aria-labelledby="existing-photos" className="flex flex-col gap-3">
          <h3 id="existing-photos" className="text-xl font-bold">
            Already on this day
          </h3>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            {existing.map((item) => (
              <li key={item.id} className="flex min-w-0 flex-col gap-2">
                <MediaTile id={item.id} contentType={item.contentType} caption={item.caption} />
                <CaptionEditor
                  mediaId={item.id}
                  initial={item.caption}
                  canEdit={coach || item.uploaderId === userId}
                />
                <p className="text-sm text-ink-muted">{item.uploaderName}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div>
        <BackToJournal />
      </div>
    </div>
  );
}

function RobotTab({
  meeting,
  meetingKey,
  missions,
  assignedMissionIds,
  resolveMeeting,
  status,
  setStatus,
}: TabCommon & {
  meeting: EditorMeeting | null;
  meetingKey: string;
  missions: EditorMission[];
  assignedMissionIds: number[];
  resolveMeeting: () => Promise<string>;
}) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<number, MissionStatus>>(() =>
    Object.fromEntries(missions.map((item) => [item.id, item.status])),
  );
  const mine = missions.filter((item) => assignedMissionIds.includes(item.id));
  const others = missions.filter((item) => !assignedMissionIds.includes(item.id));
  const [noteMissionId, setNoteMissionId] = useState<number>(
    (mine[0] ?? missions[0])?.id ?? 0,
  );
  const [body, setBody, clearDraft] = useDraft(`draft:robot:${meetingKey}`);
  const [saving, setSaving] = useState(false);

  async function choose(item: EditorMission, next: MissionStatus) {
    const previous = statuses[item.id] ?? item.status;
    if (previous === next) {
      return;
    }
    setStatuses((state) => ({ ...state, [item.id]: next }));
    setNoteMissionId(item.id);
    setStatus(null);
    try {
      const meetingId = await resolveMeeting();
      const result = await setMissionStatusAction({
        missionId: item.id,
        status: next,
        meetingId,
      });
      if ("error" in result && result.error) {
        throw new Error(result.error);
      }
      setStatus({
        tone: "ok",
        lead: "Saved.",
        text: `${item.name}: ${MISSION_STATUS_LABELS[next].toLowerCase()}.`,
      });
      if (!meeting) {
        router.replace(`/journal/${meetingId}?tab=robot`);
      }
    } catch {
      setStatuses((state) => ({ ...state, [item.id]: previous }));
      setStatus({ tone: "error", lead: SAVE_ERROR, text: "" });
    }
  }

  async function saveNote() {
    setSaving(true);
    setStatus(null);
    try {
      const meetingId = meeting ? meeting.id : await resolveMeeting();
      const result = await postMissionNote({ missionId: noteMissionId, body, meetingId });
      if ("error" in result && result.error) {
        setStatus({ tone: "error", lead: result.error ?? SAVE_ERROR, text: "" });
        return;
      }
      clearDraft();
      setStatus({ tone: "ok", lead: "Saved.", text: "Your note is on the mission and the journal." });
      if (!meeting) {
        router.replace(`/journal/${meetingId}?tab=robot`);
      }
    } catch {
      setStatus({ tone: "error", lead: SAVE_ERROR, text: "" });
    } finally {
      setSaving(false);
    }
  }

  function row(item: EditorMission) {
    const current = statuses[item.id] ?? item.status;
    return (
      <li key={item.id} className="flex flex-col gap-2 rounded-xl border border-line p-3">
        <p className="font-semibold">
          <span className="font-mono text-primary">{missionCode(item.number)}</span> {item.name}
        </p>
        <div role="group" aria-label={`${item.name} status`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MISSION_STATUSES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={current === option}
              onClick={() => void choose(item, option)}
              className={cn(
                "min-h-12 rounded-xl border-2 px-2 text-base font-semibold transition-colors",
                current === option
                  ? cn(STATUS_CLASSES[option], "border-transparent")
                  : "border-line bg-card hover:border-primary/60",
              )}
            >
              {MISSION_STATUS_LABELS[option]}
            </button>
          ))}
        </div>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold">How did each mission go?</h2>
        <p className="text-ink-muted">Tap a status. It saves right away.</p>
      </div>

      {mine.length > 0 ? <ul className="flex flex-col gap-3">{mine.map(row)}</ul> : null}
      {others.length > 0 ? (
        mine.length > 0 ? (
          <details className="flex flex-col gap-3">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-primary">
              Show all missions
            </summary>
            <ul className="mt-3 flex flex-col gap-3">{others.map(row)}</ul>
          </details>
        ) : (
          <ul className="flex flex-col gap-3">{others.map(row)}</ul>
        )
      ) : null}

      <StatusLine status={status} />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void saveNote();
        }}
        className="flex flex-col gap-3 rounded-2xl bg-primary-tint-soft p-4"
      >
        <h3 className="text-xl font-bold">What did you change?</h3>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="robot-note-mission" className="text-base">
            Mission
          </Label>
          <select
            id="robot-note-mission"
            value={noteMissionId}
            onChange={(event) => setNoteMissionId(Number(event.target.value))}
            className="h-12 rounded-xl border border-line bg-card px-3 text-base"
          >
            {missions.map((item) => (
              <option key={item.id} value={item.id}>
                {missionCode(item.number)} {item.name}
              </option>
            ))}
          </select>
        </div>
        <Textarea
          aria-label="What did you change?"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={4000}
          rows={3}
          placeholder="We tried… / It works better when…"
          className="min-h-24 rounded-xl bg-card px-3 py-2 text-lg md:text-lg"
        />
        <div>
          <Button
            type="submit"
            size="xl"
            disabled={saving || !body.trim()}
            className="rounded-xl"
          >
            {saving ? "Saving…" : "Save note"}
          </Button>
        </div>
      </form>

      <div>
        <BackToJournal />
      </div>
    </div>
  );
}
