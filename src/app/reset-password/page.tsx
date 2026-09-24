"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

const fieldClass = "h-12 px-3 text-lg md:text-lg";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const invalid = params.get("error") === "INVALID_TOKEN" || !token;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) {
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setPending(false);
    if (result.error) {
      setError("That reset link is used up. Ask a coach to send a new one.");
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
      <h1 className="mb-8 text-4xl font-semibold">Rolling Sparks</h1>
      {invalid ? (
        <Alert variant="destructive">
          <AlertDescription className="text-lg">
            This reset link is missing or used up. Ask a coach to send a new one.
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold">Choose a new password</h2>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password" className="text-lg">
              New password
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
            <Label htmlFor="confirm-password" className="text-lg">
              Type it again
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
              <AlertDescription className="text-lg">{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" size="xl" disabled={pending}>
            Save password
          </Button>
        </form>
      )}
    </main>
  );
}
