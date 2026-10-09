import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isParent } from "@/lib/roles";
import {
  MAX_TEAM_PROJECT_BYTES,
  objectKeyForTeamProjectUpload,
  presignTeamProjectUpload,
  storageConfig,
} from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof auth.api.getSession>>;
  try {
    session = await auth.api.getSession({ headers: request.headers });
  } catch (error) {
    console.error("Team project upload session failed", error);
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (session.user.mustChangePassword) {
    return NextResponse.json(
      { error: "Set a new password before uploading." },
      { status: 403 },
    );
  }
  if (session.user.mustSetDisplayName) {
    return NextResponse.json(
      { error: "Choose your display name before uploading." },
      { status: 403 },
    );
  }
  if (isParent(session.user.role)) {
    return NextResponse.json(
      { error: "Parents cannot upload team project code." },
      { status: 403 },
    );
  }

  if (!storageConfig()) {
    return NextResponse.json(
      { error: "File saving is not set up yet. Ask a coach." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Choose a .zip file." }, { status: 400 });
  }

  const fileName =
    typeof body === "object" && body !== null && "fileName" in body
      ? String(body.fileName)
      : "";
  const size =
    typeof body === "object" && body !== null && "size" in body && typeof body.size === "number"
      ? body.size
      : NaN;

  if (!fileName.toLowerCase().endsWith(".zip")) {
    return NextResponse.json(
      { error: "That is not a zip file. Pick the pybricks-backup file you saved from Pybricks." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_TEAM_PROJECT_BYTES) {
    return NextResponse.json({ error: "That file is too large." }, { status: 400 });
  }

  const key = objectKeyForTeamProjectUpload(session.user.id);
  const signed = await presignTeamProjectUpload(key, size);
  if (!signed) {
    return NextResponse.json(
      { error: "File saving is not set up yet. Ask a coach." },
      { status: 400 },
    );
  }

  return NextResponse.json({ url: signed.url, key, contentType: signed.contentType });
}
