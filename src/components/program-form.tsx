"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addNewProgram, saveProgramName, uploadProgramVersion } from "@/lib/actions";

const fieldClass = "h-12 px-3 text-lg md:text-lg";

type MissionChoice = {
  id: number;
  number: number;
  name: string;
};

export function ProgramForm({
  mode,
  programId,
  defaultName,
  defaultMissionIds,
  missions,
}: {
  mode: "create" | "version";
  programId?: string;
  defaultName: string;
  defaultMissionIds: number[];
  missions: MissionChoice[];
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState(() => new Set(defaultMissionIds));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function toggleMission(id: number, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const action = submitter instanceof HTMLButtonElement ? submitter.value : "upload";
    setError(null);
    setMessage(null);
    setPending(true);

    try {
      if (action === "save-name") {
        if (!programId) {
          setError("That program is missing.");
          return;
        }
        const result = await saveProgramName(programId, name);
        if ("error" in result && result.error) {
          setError(result.error);
          return;
        }
        setMessage("message" in result ? result.message : "Name saved.");
        router.refresh();
        return;
      }

      const form = event.currentTarget;
      const fileInput = form.elements.namedItem("file");
      const file = fileInput instanceof HTMLInputElement ? fileInput.files?.[0] : undefined;
      if (!file) {
        setError("Choose a .llsp3 file.");
        return;
      }
      if (!file.name.toLowerCase().endsWith(".llsp3")) {
        setError("Choose a .llsp3 file.");
        return;
      }

      const ticketResponse = await fetch("/api/storage/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, size: file.size }),
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

      const payload = {
        name,
        note,
        missionIds: [...selected],
        objectKey: ticket.key,
        fileName: file.name,
      };

      const result =
        mode === "create"
          ? await addNewProgram(payload)
          : await uploadProgramVersion({ ...payload, programId: programId ?? "" });

      if (result && "error" in result && result.error) {
        setError(result.error);
      }
    } catch (caught) {
      if (isRedirect(caught)) {
        return;
      }
      setError("The file did not upload. Try again. If this keeps happening, ask a coach.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="program-name" className="text-lg">
          Name
        </Label>
        <Input
          id="program-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={fieldClass}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="program-file" className="text-lg">
          .llsp3 file
        </Label>
        <Input
          id="program-file"
          name="file"
          type="file"
          accept=".llsp3,application/octet-stream,application/zip"
          className={`${fieldClass} py-2`}
        />
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-lg font-medium">Missions</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {missions.map((item) => (
            <label key={item.id} className="flex items-center gap-3">
              <Checkbox
                checked={selected.has(item.id)}
                onCheckedChange={(value) => toggleMission(item.id, value === true)}
                className="size-6"
              />
              <span>
                {item.number} {item.name}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor="program-note" className="text-lg">
          What did you change?
        </Label>
        <Textarea
          id="program-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="min-h-28 px-3 py-3 text-lg md:text-lg"
        />
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="text-lg">{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert>
          <AlertDescription className="text-lg">{message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-3">
        {mode === "version" ? (
          <Button type="submit" value="save-name" variant="outline" size="xl" disabled={pending}>
            Save name
          </Button>
        ) : null}
        <Button type="submit" value="upload" size="xl" disabled={pending}>
          {mode === "create" ? "Add program" : "Upload a new version"}
        </Button>
      </div>
    </form>
  );
}

function isRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}
