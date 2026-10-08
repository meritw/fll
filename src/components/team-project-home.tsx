"use client";

import { useRef, useState } from "react";
import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitTeamProjectUpload } from "@/lib/actions";
import { PYBRICKS_CODE_URL, UPLOAD_NOTE_REQUIRED_ERROR } from "@/lib/team-project/constants";

const BASE_SHA_KEY = "rs-team-project-base-sha";
const DOWNLOAD_FILE_NAME = "RollingSparks.zip";

const DOWNLOAD_FAILED =
  "The download did not work. Click the button again. If it still does not work, ask a coach.";
const UPLOAD_FAILED =
  "The upload did not work. Click Upload to team code again. If it still does not work, ask a coach.";
const PICK_BACKUP_FIRST = "First click Choose zip file and pick your pybricks-backup file.";
const NOT_A_ZIP =
  "That is not a zip file. Click Choose zip file and pick your pybricks-backup file.";

const SCREENSHOT = { src: "/pybricks-backup-all-files.png", width: 2008, height: 1428 };

// Pixel boxes inside SCREENSHOT; the green arrow does not overlap any of them.
const PYBRICKS_ICONS = {
  toolbar: {
    x: 300,
    y: 188,
    width: 170,
    height: 48,
    label: "The 3 small Pybricks icons: box with a down arrow, up arrow, plus sign",
  },
  explorer: { x: 40, y: 22, width: 120, height: 120, label: "Pybricks page icon" },
  importFile: {
    x: 365,
    y: 188,
    width: 48,
    height: 48,
    label: "Pybricks up arrow icon (Import a file)",
  },
  backupAll: {
    x: 305,
    y: 188,
    width: 48,
    height: 48,
    label: "Pybricks box with a down arrow icon (Backup all files)",
  },
} as const;

const ICON_HEIGHT_PX = 40;

const UPLOAD_STATUS_LABELS: Record<string, string> = {
  seeded: "first team code",
  merged: "added to team code",
  conflict: "waiting for a coach",
};

export function rememberDownloadSha(sha: string | null | undefined) {
  try {
    if (sha) {
      sessionStorage.setItem(BASE_SHA_KEY, sha);
    }
  } catch {
    // ignore
  }
}

function readDownloadSha() {
  try {
    return sessionStorage.getItem(BASE_SHA_KEY);
  } catch {
    return null;
  }
}

function PybricksIcon({ icon }: { icon: keyof typeof PYBRICKS_ICONS }) {
  const { x, y, width, height, label } = PYBRICKS_ICONS[icon];
  const scale = ICON_HEIGHT_PX / height;
  return (
    <span
      role="img"
      aria-label={label}
      className="mx-1 inline-block shrink-0 rounded-md border border-border bg-no-repeat align-middle"
      style={{
        width: Math.round(width * scale),
        height: ICON_HEIGHT_PX,
        backgroundImage: `url(${SCREENSHOT.src})`,
        backgroundSize: `${SCREENSHOT.width * scale}px ${SCREENSHOT.height * scale}px`,
        backgroundPosition: `${-x * scale}px ${-y * scale}px`,
      }}
    />
  );
}

type Note = { kind: "info" | "error"; text: string };

function NoteAlert({ note }: { note: Note | null }) {
  if (!note) {
    return null;
  }
  return (
    <Alert variant={note.kind === "error" ? "destructive" : "default"} className="max-w-xl">
      <AlertDescription
        className={note.kind === "error" ? "text-base" : "text-base font-medium text-foreground"}
      >
        {note.text}
      </AlertDescription>
    </Alert>
  );
}

type Props = {
  headSha: string | null;
  storageReady: boolean;
  openConflictCount: number;
  isCoach: boolean;
  commits: Array<{
    id: string;
    sha: string;
    message: string;
    createdAt: Date | string;
    uploadedByName: string | null;
  }>;
  recentUploads: Array<{
    id: string;
    status: string;
    message: string;
    fileName: string;
    createdAt: Date | string;
    uploadedByName: string | null;
  }>;
};

export function TeamProjectHome({
  headSha,
  storageReady,
  openConflictCount,
  isCoach,
  commits,
  recentUploads,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [noteMissing, setNoteMissing] = useState(false);
  const [downloadNote, setDownloadNote] = useState<Note | null>(null);
  const [uploadNote, setUploadNote] = useState<Note | null>(null);
  const [pending, setPending] = useState(false);

  const pickedDownloadedZip = file?.name.toLowerCase().startsWith("rollingsparks") ?? false;

  async function onDownload() {
    setDownloadNote(null);
    try {
      const response = await fetch("/api/team-project/download", {
        method: "GET",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setDownloadNote({ kind: "error", text: DOWNLOAD_FAILED });
        return;
      }
      rememberDownloadSha(response.headers.get("X-Team-Project-Sha"));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = DOWNLOAD_FILE_NAME;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setDownloadNote({
        kind: "info",
        text: "Downloaded! RollingSparks.zip is in your Downloads folder. Now do Step 2.",
      });
    } catch {
      setDownloadNote({ kind: "error", text: DOWNLOAD_FAILED });
    }
  }

  async function onUpload(event: React.FormEvent) {
    event.preventDefault();
    setUploadNote(null);
    if (!file) {
      setUploadNote({ kind: "error", text: PICK_BACKUP_FIRST });
      return;
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setUploadNote({ kind: "error", text: NOT_A_ZIP });
      return;
    }
    const note = message.trim();
    if (!note) {
      setNoteMissing(true);
      setUploadNote({ kind: "error", text: UPLOAD_NOTE_REQUIRED_ERROR });
      noteInputRef.current?.focus();
      return;
    }

    setPending(true);
    try {
      const presign = await fetch("/api/storage/team-project/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, size: file.size }),
      });
      const presignBody = (await presign.json()) as {
        error?: string;
        url?: string;
        key?: string;
        contentType?: string;
      };
      if (!presign.ok || !presignBody.url || !presignBody.key) {
        setUploadNote({ kind: "error", text: presignBody.error || UPLOAD_FAILED });
        return;
      }

      const put = await fetch(presignBody.url, {
        method: "PUT",
        headers: { "Content-Type": presignBody.contentType || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) {
        setUploadNote({ kind: "error", text: UPLOAD_FAILED });
        return;
      }

      const result = await submitTeamProjectUpload({
        objectKey: presignBody.key,
        fileName: file.name,
        message: note,
        baseSha: readDownloadSha() || headSha,
      });
      if ("error" in result && result.error) {
        setUploadNote({ kind: "error", text: result.error });
        return;
      }
      if (!("status" in result) || !result.status) {
        setUploadNote({ kind: "error", text: UPLOAD_FAILED });
        return;
      }
      if (result.status === "conflict") {
        const count = result.conflictCount ?? 0;
        setUploadNote({
          kind: "info",
          text: `Done! Your work is saved. A coach needs to check ${count} file${
            count === 1 ? "" : "s"
          } before your changes join the team code.`,
        });
      } else if (result.status === "seeded") {
        setUploadNote({
          kind: "info",
          text: "Done! You saved the first team code. Next time you code, start again at Step 1.",
        });
      } else {
        setUploadNote({
          kind: "info",
          text: "Done! Your changes are in the team code. Next time you code, start again at Step 1.",
        });
        if ("sha" in result && result.sha) {
          rememberDownloadSha(result.sha);
        }
      }
      setFile(null);
      setMessage("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      setUploadNote({ kind: "error", text: UPLOAD_FAILED });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Rolling Sparks Coding Page
        </h1>
        <p className="mt-3 max-w-2xl text-xl">
          Do these 3 steps in order every time you code. Keep this tab open until you finish Step
          3.
        </p>
      </div>

      {!storageReady ? (
        <Alert>
          <AlertDescription>File saving is not set up yet. Ask a coach.</AlertDescription>
        </Alert>
      ) : null}

      {openConflictCount > 0 ? (
        <Alert>
          <AlertDescription>
            {isCoach ? (
              <>
                {openConflictCount} conflict{openConflictCount === 1 ? "" : "s"} waiting for a
                coach.{" "}
                <Link href="/conflicts" className="font-medium underline underline-offset-4">
                  Review conflicts
                </Link>
              </>
            ) : (
              `A coach is checking ${openConflictCount} file${
                openConflictCount === 1 ? "" : "s"
              } from an earlier upload. You can still do the steps below.`
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <ol className="flex flex-col gap-6">
        <li className="flex flex-col gap-4 border-b border-border/80 pb-8">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">Step 1</p>
          <h2 className="text-2xl font-semibold">Download the team code</h2>
          <p className="text-lg text-muted-foreground">
            Get the team&apos;s current Pybricks project
          </p>
          <ol className="flex list-decimal flex-col gap-4 pl-7 text-lg marker:font-semibold">
            <li>
              Click this button:
              <div className="mt-2">
                <Button size="xl" type="button" onClick={onDownload} disabled={!storageReady}>
                  Download RollingSparks.zip
                </Button>
              </div>
            </li>
            <li>
              Your computer saves <strong>RollingSparks.zip</strong> in your{" "}
              <strong>Downloads</strong> folder. If a Save window pops up, click{" "}
              <strong>Save</strong>.
            </li>
          </ol>
          <NoteAlert note={downloadNote} />
        </li>

        <li className="flex flex-col gap-4 border-b border-border/80 pb-8">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">Step 2</p>
          <h2 className="text-2xl font-semibold">Open Pybricks and load the team code</h2>
          <p className="text-lg text-muted-foreground">
            Start here: put RollingSparks.zip into Pybricks.
          </p>
          <ol className="flex list-decimal flex-col gap-4 pl-7 text-lg marker:font-semibold">
            <li>
              Click this button:
              <div className="mt-2">
                <Button asChild size="xl">
                  <a href={PYBRICKS_CODE_URL} target="_blank" rel="noopener noreferrer">
                    Open Pybricks
                  </a>
                </Button>
              </div>
              <p className="mt-2">
                Pybricks opens in a new tab. To read the next step, click the{" "}
                <strong>Coding Page</strong> tab at the top of your browser.
              </p>
            </li>
            <li>
              Do you see a box that says <strong>Welcome to Pybricks Code</strong>? Click the{" "}
              <strong>X</strong> in its top right corner to close it.
            </li>
            <li>
              Find these 3 small icons on the left side of Pybricks:
              <PybricksIcon icon="toolbar" />
              <p className="mt-2">
                Don&apos;t see them? Click this page icon at the top left:
                <PybricksIcon icon="explorer" />
              </p>
            </li>
            <li>
              Click this <strong>up arrow</strong>:
              <PybricksIcon icon="importFile" />
              <p className="mt-2">
                When you point at it, it says <strong>Import a file</strong>.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element -- static instructional screenshot */}
              <img
                src="/pybricks-upload-rolling-sparks.png"
                alt="Pybricks screen. A red arrow points to the up arrow icon above the file list. Text: Start Here, Upload RollingSparks.zip."
                className="mt-3 w-full max-w-xl rounded-lg border border-border/80"
              />
            </li>
            <li>
              A window opens. Click <strong>Downloads</strong>. Click{" "}
              <strong>RollingSparks.zip</strong>. Click <strong>Open</strong>.
              <p className="mt-2">
                See more than one RollingSparks file? Pick the one with the biggest number, like{" "}
                <strong>RollingSparks (2).zip</strong>.
              </p>
            </li>
            <li>
              Do you see a box that says <strong>Replace existing file?</strong> First click the
              check box next to <strong>Remember this answer</strong>. Then click the red button{" "}
              <strong>Replace the existing file with the imported file</strong>.
            </li>
            <li>
              Now the team files are in the list on the left. Click a file name to open it. Make
              your changes.
            </li>
          </ol>
        </li>

        <li className="flex flex-col gap-4">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">Step 3</p>
          <h2 className="text-2xl font-semibold">Back up your work and upload it here</h2>
          <p className="text-lg text-muted-foreground">
            When you are done, save your work from Pybricks and send it to the team.
          </p>
          <form onSubmit={onUpload}>
            <ol className="flex list-decimal flex-col gap-4 pl-7 text-lg marker:font-semibold">
              <li>
                In Pybricks, find the 3 small icons on the left side again:
                <PybricksIcon icon="toolbar" />
              </li>
              <li>
                Click this <strong>box with a down arrow</strong>:
                <PybricksIcon icon="backupAll" />
                <p className="mt-2">
                  When you point at it, it says <strong>Backup all files</strong>.
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element -- static instructional screenshot */}
                <img
                  src="/pybricks-backup-all-files.png"
                  alt="Pybricks screen. A green arrow points to the box with a down arrow icon above the file list. Text: When you are done, click Backup All Files and save the zip file."
                  className="mt-3 w-full max-w-xl rounded-lg border border-border/80"
                />
              </li>
              <li>
                A Save window opens. Click <strong>Downloads</strong>. Click{" "}
                <strong>Save</strong>. Your file&apos;s name starts with{" "}
                <strong>pybricks-backup</strong>.
                <p className="mt-2">No Save window? The file goes into Downloads by itself.</p>
              </li>
              <li>
                Click the <strong>Coding Page</strong> tab at the top of your browser to come back
                to this page.
              </li>
              <li>
                Click this button:
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip,application/zip"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                    disabled={!storageReady || pending}
                    onChange={(event) => {
                      setUploadNote(null);
                      setFile(event.target.files?.[0] ?? null);
                    }}
                  />
                  <Button
                    size="xl"
                    type="button"
                    variant="outline"
                    disabled={!storageReady || pending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose zip file
                  </Button>
                </div>
                <p className="mt-2">
                  A window opens. Click <strong>Downloads</strong>. Click your{" "}
                  <strong>pybricks-backup</strong> file. Click <strong>Open</strong>. More than
                  one? Pick the one with the newest date in its name.
                </p>
                <p className="mt-2" aria-live="polite">
                  {file ? (
                    <>
                      You picked: <strong className="break-all">{file.name}</strong>
                    </>
                  ) : (
                    <span className="text-muted-foreground">No file picked yet.</span>
                  )}
                </p>
                {pickedDownloadedZip ? (
                  <p className="mt-2 font-medium text-destructive">
                    That is the file from Step 1. Click Choose zip file again and pick your
                    pybricks-backup file.
                  </p>
                ) : null}
              </li>
              <li>
                <Label htmlFor="team-note" className="text-lg leading-normal font-normal">
                  Write a note about what you changed
                </Label>
                <Input
                  ref={noteInputRef}
                  id="team-note"
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    if (event.target.value.trim()) {
                      setNoteMissing(false);
                    }
                  }}
                  className="mt-2 h-12 max-w-xl text-lg"
                  placeholder="Example: Fixed the turn in mission 3"
                  aria-required="true"
                  aria-invalid={noteMissing}
                  disabled={pending}
                />
              </li>
              <li>
                Click this button:
                <div className="mt-2">
                  <Button size="xl" type="submit" disabled={!storageReady || pending}>
                    {pending ? "Uploading… please wait" : "Upload to team code"}
                  </Button>
                </div>
                <p className="mt-2">
                  Wait until you see a message that starts with <strong>Done!</strong>
                </p>
              </li>
            </ol>
          </form>
          <NoteAlert note={uploadNote} />
        </li>
      </ol>

      <section className="border-t border-border/80 pt-8">
        <h2 className="text-xl font-semibold">Recent uploads</h2>
        {recentUploads.length === 0 ? (
          <p className="mt-2 text-muted-foreground">No uploads yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-base">
            {recentUploads.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.uploadedByName}</span>
                {" · "}
                {UPLOAD_STATUS_LABELS[item.status] ?? item.status}
                {" · "}
                {item.message || item.fileName}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold">Version history</h2>
        {commits.length === 0 ? (
          <p className="mt-2 text-muted-foreground">Nothing yet. The first upload will show here.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-base">
            {commits.map((item) => (
              <li key={item.id}>
                <code className="text-sm">{item.sha.slice(0, 7)}</code>
                {" · "}
                <span className="font-medium">{item.uploadedByName}</span>
                {" · "}
                {item.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        Need the old Spike .llsp3 library?{" "}
        <Link href="/programs" className="font-medium underline underline-offset-4">
          Open programs
        </Link>
        {isCoach ? (
          <>
            {" · "}
            <Link href="/conflicts" className="font-medium underline underline-offset-4">
              Conflict review
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
