import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { verification } from "@/db/schema";
import { appSessionCookie } from "@/lib/app-session";
import { findDeliverableCoach } from "@/lib/coaches";
import { neonSessionAfter } from "@/lib/neon-mail";

export const runtime = "nodejs";

const NONCE = /^[A-Za-z0-9_-]{20,128}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nonce = url.searchParams.get("nonce") ?? "";
  const failed = NextResponse.redirect(new URL("/login?notice=link", request.url));
  if (!NONCE.test(nonce) || url.searchParams.get("error")) {
    return failed;
  }

  const identifier = `neon-link:${nonce}`;
  const [row] = await getDb()
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .limit(1);
  if (!row || row.expiresAt.getTime() <= Date.now()) {
    return failed;
  }

  const coach = await findDeliverableCoach(row.value);
  if (!coach) {
    return failed;
  }

  const clicked = await neonSessionAfter(coach.email, new Date(row.createdAt.getTime() - 30_000));
  if (!clicked) {
    return failed;
  }

  await getDb().delete(verification).where(eq(verification.identifier, identifier));
  const cookie = await appSessionCookie(coach.id);
  const response = NextResponse.redirect(new URL("/programs", request.url));
  response.headers.append("set-cookie", cookie.header);
  return response;
}
