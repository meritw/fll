"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { resolveTeamProjectConflict, submitCoachFixedZip } from "@/lib/actions";

type ConflictView = {
  id: string;
  path: string;
  kind: string;
  oursContent: string | null;
  theirsContent: string | null;
  baseContent: string | null;
  uploadedByName: string;
  uploadMessage: string;
};

export function ConflictResolveForm({ conflict }: { conflict: ConflictView }) {
  const router = useRouter();
  const [customText, setCustomText] = useState(conflict.theirsContent ?? "");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [fixedFile, setFixedFile] = useState<File | null>(null);

  async function resolve(choice: "ours" | "theirs" | "custom") {
    setPending(true);
    setError(null);
    setInfo(null);
    const result = await resolveTeamProjectConflict({
      conflictId: conflict.id,
      choice,
      customText: choice === "custom" ? customText : undefined,
    });
    setPending(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    if ("status" in result && result.status === "partial") {
      setInfo(`Saved. ${result.remaining} conflict(s) still open for this upload.`);
      router.push("/conflicts");
      router.refresh();
      return;
    }
    const sha = "sha" in result && result.sha ? result.sha.slice(0, 7) : "";
    setInfo(
      sha
        ? `All conflicts for this upload resolved. New version ${sha}.`
        : "All conflicts for this upload resolved.",
    );
    router.push("/conflicts");
    router.refresh();
  }

  async function uploadFixedZip(event: React.FormEvent) {
    event.preventDefault();
    if (!fixedFile) {
      setError("Choose a fixed .zip first.");
      return;
    }
    setPending(true);
    setError(null);
    setInfo(null);
    try {
      const presign = await fetch("/api/storage/team-project/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: fixedFile.name, size: fixedFile.size }),
      });
      const body = (await presign.json()) as {
        error?: string;
        url?: string;
        key?: string;
        contentType?: string;
      };
      if (!presign.ok || !body.url || !body.key) {
        setError(body.error || "Could not start upload.");
        return;
      }
      const put = await fetch(body.url, {
        method: "PUT",
        headers: { "Content-Type": body.contentType || "application/octet-stream" },
        body: fixedFile,
      });
      if (!put.ok) {
        setError("Upload failed.");
        return;
      }
      const result = await submitCoachFixedZip({
        objectKey: body.key,
        fileName: fixedFile.name,
        message: `Coach fixed zip for ${conflict.path}`,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setInfo("Fixed zip is now the team project HEAD. Open conflicts were closed.");
      router.push("/conflicts");
      router.refresh();
    } catch {
      setError("Fixed zip upload failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
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

      <div className="flex flex-wrap gap-3">
        <Button size="xl" type="button" disabled={pending} onClick={() => resolve("ours")}>
          Take team (current)
        </Button>
        <Button
          size="xl"
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => resolve("theirs")}
        >
          Take upload
        </Button>
      </div>

      {conflict.kind === "text" ? (
        <div className="flex flex-col gap-3">
          <Label htmlFor="custom" className="text-base">
            Or paste a fixed version of {conflict.path}
          </Label>
          <Textarea
            id="custom"
            className="min-h-48 font-mono text-sm"
            value={customText}
            onChange={(event) => setCustomText(event.target.value)}
            disabled={pending}
          />
          <Button
            size="xl"
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => resolve("custom")}
          >
            Save custom text
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground">
          Binary file — pick team or upload, or replace the whole project with a fixed zip below.
        </p>
      )}

      <form className="flex flex-col gap-3 border-t border-border/80 pt-6" onSubmit={uploadFixedZip}>
        <h2 className="text-xl font-semibold">Upload fixed project zip</h2>
        <p className="text-muted-foreground">
          Replaces the whole team project and closes open conflicts (last resort).
        </p>
        <InputFile pending={pending} onFile={setFixedFile} />
        <Button size="xl" type="submit" variant="outline" disabled={pending}>
          Upload fixed zip as HEAD
        </Button>
      </form>
    </div>
  );
}

function InputFile({
  pending,
  onFile,
}: {
  pending: boolean;
  onFile: (file: File | null) => void;
}) {
  return (
    <input
      type="file"
      accept=".zip,application/zip"
      className="h-12 text-lg"
      disabled={pending}
      onChange={(event) => onFile(event.target.files?.[0] ?? null)}
    />
  );
}
