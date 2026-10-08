"use client";

import { useState } from "react";
import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitTeamProjectUpload } from "@/lib/actions";
import { PYBRICKS_CODE_URL } from "@/lib/team-project/constants";

const BASE_SHA_KEY = "rs-team-project-base-sha";

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
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [knownBase, setKnownBase] = useState<string | null>(() => readDownloadSha());

  async function onDownload() {
    setError(null);
    setInfo(null);
    try {
      const response = await fetch("/api/team-project/download", {
        method: "GET",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setError("Could not download the project zip. Ask a coach.");
        return;
      }
      const sha = response.headers.get("X-Team-Project-Sha");
      rememberDownloadSha(sha);
      setKnownBase(sha);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "RollingSparks.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setInfo("Downloaded. Next: open Pybricks, restore this backup, then upload when done.");
    } catch {
      setError("Could not download the project zip. Ask a coach.");
    }
  }

  async function onUpload(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    if (!file) {
      setError("Choose a .zip file from Pybricks Backup.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Choose a .zip file from Pybricks Backup.");
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
        setError(presignBody.error || "Could not start the upload.");
        return;
      }

      const put = await fetch(presignBody.url, {
        method: "PUT",
        headers: { "Content-Type": presignBody.contentType || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) {
        setError("Upload to storage failed. Try again.");
        return;
      }

      const result = await submitTeamProjectUpload({
        objectKey: presignBody.key,
        fileName: file.name,
        message,
        baseSha: readDownloadSha() || headSha,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if (!("status" in result) || !result.status) {
        setError("Upload failed. Try again or ask a coach.");
        return;
      }
      if (result.status === "conflict") {
        const count = result.conflictCount ?? 0;
        setInfo(
          `Saved, but ${count} file${count === 1 ? "" : "s"} need a coach to review. Your work is not lost.`,
        );
      } else if (result.status === "seeded") {
        setInfo("First team project saved. Nice work!");
      } else {
        setInfo("Merged into the team project. Download again before the next edit.");
        if ("sha" in result && result.sha) {
          rememberDownloadSha(result.sha);
          setKnownBase(result.sha);
        }
      }
      setFile(null);
      setMessage("");
    } catch {
      setError("Upload failed. Try again or ask a coach.");
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
        <p className="mt-2 max-w-2xl text-lg text-muted-foreground">
          Download the shared Pybricks project, edit it at code.pybricks.com, then upload your
          backup zip.
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
            {openConflictCount} conflict{openConflictCount === 1 ? "" : "s"} waiting for a coach.
            {isCoach ? (
              <>
                {" "}
                <Link href="/conflicts" className="font-medium underline underline-offset-4">
                  Review conflicts
                </Link>
              </>
            ) : (
              " A coach will pick the right version."
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {info ? (
        <Alert>
          <AlertDescription>{info}</AlertDescription>
        </Alert>
      ) : null}

      <ol className="flex flex-col gap-6">
        <li className="flex flex-col gap-3 border-b border-border/80 pb-6">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">Step 1</p>
          <h2 className="text-2xl font-semibold">Download latest code</h2>
          <p className="text-muted-foreground">Get the team&apos;s current Pybricks project</p>
          <div>
            <Button size="xl" type="button" onClick={onDownload} disabled={!storageReady}>
              Download latest code
            </Button>
          </div>
          {knownBase ? (
            <p className="text-sm text-muted-foreground">
              This browser will merge against download {knownBase.slice(0, 7)}.
            </p>
          ) : null}
        </li>

        <li className="flex flex-col gap-3 border-b border-border/80 pb-6">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">Step 2</p>
          <h2 className="text-2xl font-semibold">Open Pybricks</h2>
          <p className="text-muted-foreground">
            Opens in a new tab. Use Start Here → Upload RollingSparks.zip, then edit and Backup when
            finished.
          </p>
          <div>
            <Button asChild size="xl">
              <a href={PYBRICKS_CODE_URL} target="_blank" rel="noopener noreferrer">
                Open Pybricks
              </a>
            </Button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- static instructional screenshot */}
          <img
            src="/pybricks-upload-rolling-sparks.png"
            alt="In Pybricks Code, open Start Here and choose Upload RollingSparks.zip"
            className="mt-2 w-full max-w-xl rounded-lg border border-border/80"
          />
        </li>

        <li className="flex flex-col gap-3">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">Step 3</p>
          <h2 className="text-2xl font-semibold">Upload project (.zip)</h2>
          <p className="text-muted-foreground">
            Use the backup zip from Pybricks. Optional note helps coaches see what changed.
          </p>
          <form className="flex max-w-xl flex-col gap-4" onSubmit={onUpload}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="team-zip" className="text-base">
                Pybricks backup zip
              </Label>
              <Input
                id="team-zip"
                type="file"
                accept=".zip,application/zip"
                className="h-12 text-lg"
                disabled={!storageReady || pending}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="team-note" className="text-base">
                What changed? (optional)
              </Label>
              <Input
                id="team-note"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="h-12 text-lg"
                placeholder="e.g. Fixed turn for mission 3"
                disabled={pending}
              />
            </div>
            <Button size="xl" type="submit" disabled={!storageReady || pending}>
              {pending ? "Uploading…" : "Upload project (.zip)"}
            </Button>
          </form>
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
                {item.status}
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
          <p className="mt-2 text-muted-foreground">No commits yet — upload the first zip.</p>
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
