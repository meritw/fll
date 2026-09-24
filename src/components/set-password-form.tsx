"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeForcedPasswordChange } from "@/lib/actions";

const fieldClass = "h-14 px-4 text-xl md:text-xl";
const STARTER_PASSWORD_KEY = "rs-starter-password";

export function rememberStarterPassword(password: string) {
  try {
    sessionStorage.setItem(STARTER_PASSWORD_KEY, password);
  } catch {
    // Ignore storage failures; the form can ask for the coach password.
  }
}

function takeStarterPassword() {
  try {
    const value = sessionStorage.getItem(STARTER_PASSWORD_KEY);
    sessionStorage.removeItem(STARTER_PASSWORD_KEY);
    return value;
  } catch {
    return null;
  }
}

export function SetPasswordForm({ username }: { username: string }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const stored = takeStarterPassword();
    if (stored) {
      setCurrentPassword(stored);
      setShowCurrent(false);
    }
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!currentPassword) {
      setShowCurrent(true);
      setError("Type the password from your coach first.");
      return;
    }
    if (password.length < 6) {
      setError("Pick a password with at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those new passwords do not match. Try again.");
      return;
    }

    setPending(true);
    setError(null);
    const result = await completeForcedPasswordChange({
      currentPassword,
      newPassword: password,
    });
    setPending(false);
    if (result.error) {
      setShowCurrent(true);
      setError(result.error);
      return;
    }

    router.push("/programs");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <p className="text-xl text-muted-foreground">
        Hi{username ? ` ${username}` : ""}! Before you explore programs, pick a
        password only you know.
      </p>
      {showCurrent ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="current-password" className="text-xl">
            Password from your coach
          </Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={fieldClass}
            required
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password" className="text-xl">
          Your new password
        </Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={fieldClass}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-password" className="text-xl">
          Type your new password again
        </Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className={fieldClass}
          required
        />
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="text-xl">{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" size="xl" className="h-14 text-xl" disabled={pending}>
        Save my new password
      </Button>
    </form>
  );
}
