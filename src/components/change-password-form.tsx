"use client";

import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeMyPassword } from "@/lib/actions";

const fieldClass = "h-14 px-4 text-xl md:text-xl";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<{ error?: string; message?: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 3) {
      setResult({ error: "Pick a password with at least 3 characters." });
      return;
    }
    if (password !== confirm) {
      setResult({ error: "Those new passwords do not match. Try again." });
      return;
    }
    setPending(true);
    try {
      const next = await changeMyPassword({ currentPassword, newPassword: password });
      setResult(next);
      if (!next.error) {
        setCurrentPassword("");
        setPassword("");
        setConfirm("");
      }
    } catch {
      setResult({ error: "That didn't save. Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="current-password" className="text-lg">
          Current password
        </Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          className={fieldClass}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password" className="text-lg">
          New password
        </Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={fieldClass}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-password" className="text-lg">
          New password again
        </Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className={fieldClass}
        />
      </div>
      {result?.error || result?.message ? (
        <Alert variant={result.error ? "destructive" : "default"} role="status">
          <AlertDescription className="text-base">{result.error ?? result.message}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" size="xl" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
