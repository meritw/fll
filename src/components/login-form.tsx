"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestEmailCode, requestMagicLink, requestPasswordReset } from "@/lib/actions";
import { authClient } from "@/lib/auth-client";
import {
  BAD_CODE_MESSAGE,
  BAD_PASSWORD_MESSAGE,
  SESSION_NOT_STUCK_MESSAGE,
} from "@/lib/messages";
import { rememberStarterPassword } from "@/components/set-password-form";

const fieldClass = "h-12 px-3 text-lg md:text-lg";

function loginErrorMessage(
  error: { status?: number; code?: string; message?: string } | null | undefined,
  fallback: string,
) {
  if (!error) {
    return fallback;
  }
  // Credential failures stay kid-friendly; surface other auth/config failures.
  if (error.status === 401 || error.code === "INVALID_USERNAME_OR_PASSWORD") {
    return fallback;
  }
  if (error.message && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const result = await authClient.signIn.username({
        username: username.trim(),
        password,
      });
      if (result.error) {
        setError(loginErrorMessage(result.error, BAD_PASSWORD_MESSAGE));
        return;
      }
      const sessionResult = await authClient.getSession();
      if (!sessionResult.data?.session) {
        setError(SESSION_NOT_STUCK_MESSAGE);
        return;
      }
      const user = sessionResult.data.user;
      if (user.mustChangePassword) {
        rememberStarterPassword(password);
        router.push("/set-password");
      } else if (user.mustSetDisplayName) {
        router.push("/set-name");
      } else if (user.role === "parent") {
        router.push("/journal");
      } else {
        router.push("/home");
      }
      router.refresh();
    } catch (cause) {
      const message =
        cause instanceof Error && cause.message.trim()
          ? cause.message
          : BAD_PASSWORD_MESSAGE;
      setError(message);
    } finally {
      setPending(false);
    }
  }

  async function sendLink() {
    setError(null);
    setPending(true);
    const result = await requestMagicLink(email);
    setPending(false);
    setMessage(result.message);
  }

  async function sendCode() {
    setError(null);
    setPending(true);
    const result = await requestEmailCode(email);
    setPending(false);
    setMessage(result.message);
    if (result.message !== "Add an email.") {
      setShowCode(true);
    }
  }

  async function sendReset() {
    setError(null);
    setPending(true);
    const result = await requestPasswordReset(email);
    setPending(false);
    setMessage(result.message);
  }

  async function signInWithCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await authClient.signIn.emailOtp({
        email: email.trim(),
        otp: code.trim(),
      });
      if (result.error) {
        setError(loginErrorMessage(result.error, BAD_CODE_MESSAGE));
        return;
      }
      const sessionResult = await authClient.getSession();
      if (!sessionResult.data?.session) {
        setError(SESSION_NOT_STUCK_MESSAGE);
        return;
      }
      const user = sessionResult.data.user;
      if (user.mustSetDisplayName) {
        router.push("/set-name");
      } else if (user.role === "parent") {
        router.push("/journal");
      } else {
        router.push("/home");
      }
      router.refresh();
    } catch (cause) {
      const message =
        cause instanceof Error && cause.message.trim()
          ? cause.message
          : BAD_CODE_MESSAGE;
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={signInWithPassword} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="username" className="text-lg">
            Username
          </Label>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className={fieldClass}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password" className="text-lg">
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
          Sign in
        </Button>
      </form>

      <section className="flex flex-col gap-4 border-t pt-6">
        <h2 className="text-2xl font-semibold">Coach or parent sign-in</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-lg">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-3">
          <Button type="button" size="xl" variant="secondary" disabled={pending} onClick={sendLink}>
            Email me a link
          </Button>
          <Button type="button" size="xl" variant="secondary" disabled={pending} onClick={sendCode}>
            Email me a code
          </Button>
          <Button type="button" size="xl" variant="outline" disabled={pending} onClick={sendReset}>
            Forgot password?
          </Button>
        </div>
        {message ? (
          <Alert>
            <AlertDescription className="text-lg">{message}</AlertDescription>
          </Alert>
        ) : null}
        {showCode ? (
          <form onSubmit={signInWithCode} className="flex flex-col gap-3">
            <Label htmlFor="code" className="text-lg">
              Code
            </Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className={fieldClass}
              required
            />
            <Button type="submit" size="xl" disabled={pending}>
              Sign in with code
            </Button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
