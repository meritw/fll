import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { meeting } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  isMediaContentType,
  MAX_MEDIA_BYTES,
  objectKeyForMedia,
  presignMediaUpload,
  storageConfig,
} from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof auth.api.getSession>>;
  try {
    session = await auth.api.getSession({ headers: request.headers });
  } catch (error) {
    console.error("Media upload session failed", error);
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
    return NextResponse.json({ error: "Choose a photo or video." }, { status: 400 });
  }

  const meetingId =
    typeof body === "object" && body !== null && "meetingId" in body
      ? String(body.meetingId)
      : "";
  const fileName =
    typeof body === "object" && body !== null && "fileName" in body
      ? String(body.fileName)
      : "";
  const contentType =
    typeof body === "object" && body !== null && "contentType" in body
      ? String(body.contentType)
      : "";
  const size =
    typeof body === "object" && body !== null && "size" in body && typeof body.size === "number"
      ? body.size
      : NaN;

  if (!meetingId) {
    return NextResponse.json({ error: "That meeting is missing." }, { status: 400 });
  }
  if (!fileName) {
    return NextResponse.json({ error: "Choose a photo or video." }, { status: 400 });
  }
  if (!isMediaContentType(contentType)) {
    return NextResponse.json(
      { error: "Use a photo (JPEG, PNG, WebP, HEIC) or video (MP4, MOV, WebM)." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_MEDIA_BYTES) {
    return NextResponse.json({ error: "That file is too large (512 MB max)." }, { status: 400 });
  }

  const [existing] = await getDb()
    .select({ id: meeting.id })
    .from(meeting)
    .where(eq(meeting.id, meetingId))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "That meeting is missing." }, { status: 404 });
  }

  const key = objectKeyForMedia(meetingId, contentType);
  const signed = await presignMediaUpload(key, contentType, size);
  if (!signed) {
    return NextResponse.json(
      { error: "File saving is not set up yet. Ask a coach." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    url: signed.url,
    key,
    contentType: signed.contentType,
  });
}
