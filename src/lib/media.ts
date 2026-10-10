import { count, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { journalEntry, meeting, meetingMedia } from "@/db/schema";
import { safeMediaFileName } from "@/lib/format";
import {
  HOME_MEDIA_SCOPE,
  headStorageObject,
  isJournalMediaKey,
  isMediaContentType,
  MAX_MEDIA_BYTES,
  type MediaContentType,
} from "@/lib/storage";

export { HOME_MEDIA_SCOPE };

export type GalleryMediaItem = {
  id: string;
  meetingId: string | null;
  fromHome: boolean;
  contentType: string;
  size: number;
  caption: string | null;
  fileName: string;
  createdAt: Date;
  uploaderName: string;
  uploaderId: string;
  sessionNumber: number | null;
  sessionTitle: string | null;
  sessionStartsAt: Date | null;
};

export async function listGalleryMedia(limit = 100, offset = 0): Promise<GalleryMediaItem[]> {
  const rows = await getDb().query.meetingMedia.findMany({
    orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
    limit,
    offset,
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
    fromHome: row.fromHome,
    contentType: row.contentType,
    size: row.size,
    caption: row.caption,
    fileName: row.fileName,
    createdAt: row.createdAt,
    uploaderName: row.uploader.name,
    uploaderId: row.uploader.id,
    sessionNumber: row.meeting?.sessionNumber ?? null,
    sessionTitle: row.meeting?.title ?? null,
    sessionStartsAt: row.meeting?.startsAt ?? null,
  }));
}

/** Home media with no journal note yet — shown as their own timeline cards. */
export async function listOrphanHomeMedia() {
  const rows = await getDb().query.meetingMedia.findMany({
    where: (table, { and: andOp, eq: equals, isNull: nullOp }) =>
      andOp(equals(table.fromHome, true), nullOp(table.journalEntryId)),
    orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
    with: {
      uploader: { columns: { id: true, name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    contentType: row.contentType,
    caption: row.caption,
    createdAt: row.createdAt,
    uploaderName: row.uploader.name,
    uploaderId: row.uploader.id,
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
  scopeId: string;
  objectKey: string;
  contentType: string;
  size: number;
  fileName: string;
}): Promise<{ ok: true; file: UploadedMedia } | { ok: false; error: string }> {
  if (!isMediaContentType(input.contentType)) {
    return { ok: false, error: "Use a photo (JPEG, PNG, WebP, HEIC) or video (MP4, MOV, WebM)." };
  }
  if (!isJournalMediaKey(input.scopeId, input.objectKey)) {
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
    scopeId: input.meetingId,
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
    journalEntryId: null,
    fromHome: false,
    uploaderId: input.uploaderId,
    objectKey: checked.file.key,
    contentType: checked.file.contentType,
    size: checked.file.size,
    caption,
    fileName: checked.file.fileName,
  });

  return { id };
}

/** Photos/videos for Extra notes / "from home", optionally linked to a journal entry. */
export async function attachHomeMedia(input: {
  uploaderId: string;
  objectKey: string;
  contentType: string;
  size: number;
  fileName: string;
  caption?: string;
  journalEntryId?: string | null;
}): Promise<{ id: string } | { error: string }> {
  const caption = input.caption?.trim() || null;
  if (caption && caption.length > 300) {
    return { error: "Use a shorter caption." };
  }

  const journalEntryId: string | null = input.journalEntryId?.trim() || null;
  if (journalEntryId) {
    const [entry] = await getDb()
      .select({ id: journalEntry.id, fromHome: journalEntry.fromHome, relatedMeetingId: journalEntry.relatedMeetingId })
      .from(journalEntry)
      .where(eq(journalEntry.id, journalEntryId))
      .limit(1);
    if (!entry) {
      return { error: "That note is missing." };
    }
    // Only attach to notes that aren't sitting on a meeting day-record.
    if (entry.relatedMeetingId && !entry.fromHome) {
      return { error: "Add photos for a meeting day from the Photos tab." };
    }
  }

  const checked = await assertUploadedMedia({
    scopeId: HOME_MEDIA_SCOPE,
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
    meetingId: null,
    journalEntryId,
    fromHome: true,
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
    .select({
      uploaderId: meetingMedia.uploaderId,
      meetingId: meetingMedia.meetingId,
      fromHome: meetingMedia.fromHome,
    })
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
  return { ok: true as const, meetingId: row.meetingId, fromHome: row.fromHome };
}
