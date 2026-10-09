"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeSetDisplayName } from "@/lib/actions";

const fieldClass = "h-14 px-4 text-xl md:text-xl";

export function SetNameForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await completeSetDisplayName({ displayName });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/journal");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="text-lg text-muted-foreground">
        Welcome! Choose the name the team will see on journal notes and meeting posts.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName" className="text-lg">
          Your name
        </Label>
        <Input
          id="displayName"
          name="displayName"
          autoComplete="name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className={fieldClass}
          required
          maxLength={80}
          placeholder="e.g. Alex Rivera"
        />
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="text-lg">{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" size="xl" disabled={pending}>
        {pending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
