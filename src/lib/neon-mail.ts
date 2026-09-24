import { randomBytes } from "node:crypto";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";

const appUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";

type NeonResult = { ok: true } | { ok: false };

export function neonAuthBaseUrl() {
  const value = process.env.NEON_AUTH_BASE_URL?.trim().replace(/\/$/, "");
  return value || null;
}

export function appOrigin() {
  return new URL(appUrl).origin;
}

export async function ensureNeonCoach(email: string, name: string): Promise<boolean> {
  if (await neonUserExists(email)) {
    return true;
  }

  const created = await neonAuthPost("/sign-up/email", {
    email,
    name: name.trim() || "Coach",
    password: randomBytes(24).toString("base64url"),
  });
  if (created.ok || (await neonUserExists(email))) {
    return true;
  }
  return false;
}

export async function sendNeonMagicLink(email: string, callbackURL: string) {
  return neonAuthPost("/sign-in/magic-link", { email, callbackURL });
}

export async function sendNeonEmailCode(email: string) {
  return neonAuthPost("/email-otp/send-verification-otp", {
    email,
    type: "sign-in",
  });
}

export async function verifyNeonEmailCode(email: string, otp: string) {
  return neonAuthPost("/sign-in/email-otp", { email, otp });
}

export async function sendNeonPasswordReset(email: string, redirectTo: string) {
  return neonAuthPost("/request-password-reset", { email, redirectTo });
}

export async function consumeNeonPasswordReset(token: string, newPassword: string) {
  return neonAuthPost("/reset-password", { token, newPassword });
}

export async function neonUserExists(email: string) {
  const result = await getDb().execute(
    sql`select id::text as id from neon_auth."user" where lower(email) = ${email} limit 1`,
  );
  return rowsOf(result).length > 0;
}

export async function neonResetEmail(token: string) {
  const result = await getDb().execute(sql`
    select u.email as email
    from neon_auth.verification v
    join neon_auth."user" u on u.id::text = v.value
    where v.identifier = ${`reset-password:${token}`}
      and v."expiresAt" > now()
    limit 1
  `);
  const email = rowsOf(result)[0]?.email;
  return typeof email === "string" ? email : null;
}

export async function neonSessionAfter(email: string, since: Date) {
  const result = await getDb().execute(sql`
    select s.id::text as id
    from neon_auth.session s
    join neon_auth."user" u on u.id = s."userId"
    where lower(u.email) = ${email}
      and s."createdAt" >= ${since}
      and s."expiresAt" > now()
    limit 1
  `);
  return rowsOf(result).length > 0;
}

async function neonAuthPost(path: string, body: Record<string, string>): Promise<NeonResult> {
  const baseUrl = neonAuthBaseUrl();
  if (!baseUrl) {
    console.warn("[email] NEON_AUTH_BASE_URL is not set, so Neon Auth did not send email.");
    return { ok: false };
  }

  let origin: string;
  try {
    origin = appOrigin();
  } catch {
    console.error("[email] BETTER_AUTH_URL is not a valid URL.");
    return { ok: false };
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const code = await errorCode(response);
    console.error(`[email] Neon Auth ${path} failed`, response.status, code);
    return { ok: false };
  }
  return { ok: true };
}

async function errorCode(response: Response) {
  try {
    const body = (await response.json()) as { code?: unknown };
    return typeof body.code === "string" ? body.code : "unknown";
  } catch {
    return "unknown";
  }
}

function rowsOf(result: unknown) {
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as Array<Record<string, unknown>>;
  }
  return [];
}
