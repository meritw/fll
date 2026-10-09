import { count, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { meeting, meetingMedia } from "@/db/schema";
import { safeMediaFileName } from "@/lib/format";
import {
  headStorageObject,
  isJournalMediaKey,
  isMediaContentType,
  MAX_MEDIA_BYTES,
  type MediaContentType,
} from "@/lib/storage";

export async function listGalleryMedia(limit = 100) {
  const rows = await getDb().query.meetingMedia.findMany({
    orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
    limit,
    with: {
      uploader: { columns: { id: true, name: true } },
      meeting: {
        columns: {
          id: true,
          title: true,
          sessionNumber: true,
          startsAt: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    meetingId: row.meetingId,
    contentType: row.contentType,
    size: row.size,
    caption: row.caption,
    fileName: row.fileName,
    createdAt: row.createdAt,
    uploaderName: row.uploader.name,
    uploaderId: row.uploader.id,
    sessionNumber: row.meeting.sessionNumber,
    sessionTitle: row.meeting.title,
    sessionStartsAt: row.meeting.startsAt,
  }));
}

export async function getMeetingMediaFile(id: string) {
  const row = await getDb().query.meetingMedia.findFirst({
    where: (table, { eq: equals }) => equals(table.id, id),
    columns: {
      id: true,
      objectKey: true,
      contentType: true,
      fileName: true,
      size: true,
    },
  });
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    objectKey: row.objectKey,
    contentType: row.contentType,
    fileName: row.fileName,
    size: row.size,
  };
}

type UploadedMedia = {
  key: string;
  contentType: MediaContentType;
  size: number;
  fileName: string;
};

async function assertUploadedMedia(input: {
  meetingId: string;
  objectKey: string;
  contentType: string;
  size: number;
  fileName: string;
}): Promise<{ ok: true; file: UploadedMedia } | { ok: false; error: string }> {
  if (!isMediaContentType(input.contentType)) {
    return { ok: false, error: "Use a photo (JPEG, PNG, WebP, HEIC) or video (MP4, MOV, WebM)." };
  }
  if (!isJournalMediaKey(input.meetingId, input.objectKey)) {
    return { ok: false, error: "The file did not upload. Try again." };
  }
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > MAX_MEDIA_BYTES) {
    return { ok: false, error: "That file is too large (512 MB max)." };
  }

  try {
    const meta = await headStorageObject(input.objectKey);
    if (!meta) {
      return { ok: false, error: "File saving is not set up yet. Ask a coach." };
    }
    if (meta.size <= 0 || meta.size > MAX_MEDIA_BYTES) {
      return { ok: false, error: "That file is too large (512 MB max)." };
    }
    return {
      ok: true,
      file: {
        key: input.objectKey,
        contentType: input.contentType,
        size: meta.size,
        fileName: safeMediaFileName(input.fileName),
      },
    };
  } catch (error) {
    console.error("Media storage lookup failed", error);
    return { ok: false, error: "The file did not upload. Try again." };
  }
}

export async function attachMeetingMedia(input: {
  meetingId: string;
  uploaderId: string;
  objectKey: string;
  contentType: string;
  size: number;
  fileName: string;
  caption?: string;
}): Promise<{ id: string } | { error: string }> {
  const [existing] = await getDb()
    .select({ id: meeting.id })
    .from(meeting)
    .where(eq(meeting.id, input.meetingId))
    .limit(1);
  if (!existing) {
    return { error: "That meeting is missing." };
  }

  const caption = input.caption?.trim() || null;
  if (caption && caption.length > 300) {
    return { error: "Use a shorter caption." };
  }

  const checked = await assertUploadedMedia({
    meetingId: input.meetingId,
    objectKey: input.objectKey,
    contentType: input.contentType,
    size: input.size,
    fileName: input.fileName,
  });
  if (!checked.ok) {
    return { error: checked.error };
  }

  const id = crypto.randomUUID();
  await getDb().insert(meetingMedia).values({
    id,
    meetingId: input.meetingId,
    uploaderId: input.uploaderId,
    objectKey: checked.file.key,
    contentType: checked.file.contentType,
    size: checked.file.size,
    caption,
    fileName: checked.file.fileName,
  });

  return { id };
}

export async function countMedia() {
  const [row] = await getDb().select({ value: count() }).from(meetingMedia);
  return row?.value ?? 0;
}

/** Uploaders fix their own captions; coaches can fix any. */
export async function updateMediaCaption(input: {
  mediaId: string;
  caption: string;
  userId: string;
  isCoach: boolean;
}) {
  const caption = input.caption.trim() || null;
  if (caption && caption.length > 300) {
    return { error: "Use a shorter caption." };
  }
  const [row] = await getDb()
    .select({ uploaderId: meetingMedia.uploaderId, meetingId: meetingMedia.meetingId })
    .from(meetingMedia)
    .where(eq(meetingMedia.id, input.mediaId))
    .limit(1);
  if (!row) {
    return { error: "That photo is missing." };
  }
  if (row.uploaderId !== input.userId && !input.isCoach) {
    return { error: "Only the person who added it can change the caption." };
  }
  await getDb().update(meetingMedia).set({ caption }).where(eq(meetingMedia.id, input.mediaId));
  return { ok: true as const, meetingId: row.meetingId };
}
