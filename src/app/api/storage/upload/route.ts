import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  MAX_PROGRAM_BYTES,
  objectKeyForUser,
  presignProgramUpload,
  storageConfig,
} from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (session.user.mustChangePassword) {
    return NextResponse.json(
      { error: "Set a new password before uploading." },
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
    return NextResponse.json({ error: "Choose a .llsp3 file." }, { status: 400 });
  }

  const fileName =
    typeof body === "object" && body !== null && "fileName" in body
      ? String(body.fileName)
      : "";
  const size =
    typeof body === "object" && body !== null && "size" in body && typeof body.size === "number"
      ? body.size
      : NaN;

  if (!fileName.toLowerCase().endsWith(".llsp3")) {
    return NextResponse.json({ error: "Choose a .llsp3 file." }, { status: 400 });
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_PROGRAM_BYTES) {
    return NextResponse.json({ error: "That file is too large." }, { status: 400 });
  }

  const key = objectKeyForUser(session.user.id);
  const signed = await presignProgramUpload(key, size);
  if (!signed) {
    return NextResponse.json(
      { error: "File saving is not set up yet. Ask a coach." },
      { status: 400 },
    );
  }

  return NextResponse.json({ url: signed.url, key, contentType: signed.contentType });
}
