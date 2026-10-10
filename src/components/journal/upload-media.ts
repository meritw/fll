"use client";

import { saveMeetingMedia } from "@/lib/actions";

/** Same token as `HOME_MEDIA_SCOPE` in `@/lib/storage` (kept here so the client avoids AWS imports). */
export const HOME_UPLOAD_SCOPE = "home";

export const MEDIA_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm,.jpg,.jpeg,.png,.webp,.heic,.heif,.mp4,.mov,.webm";

const MAX_BYTES = 512 * 1024 * 1024;

const EXT_TO_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

export function resolveContentType(file: File) {
  if (file.type && Object.values(EXT_TO_TYPE).includes(file.type)) {
    return file.type;
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_TYPE[ext] ?? "";
}

/** PUT with progress (fetch can't report upload progress). */
function putWithProgress(
  url: string,
  contentType: string,
  file: File,
  onProgress: (fraction: number) => void,
) {
  return new Promise<boolean>((resolve) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    };
    request.onload = () => resolve(request.status >= 200 && request.status < 300);
    request.onerror = () => resolve(false);
    request.send(file);
  });
}

/**
 * Presign → upload to storage → attach.
 * `meetingId` is a real meeting id, or `"home"` / HOME_MEDIA_SCOPE for Extra notes.
 */
export async function uploadMeetingMedia(
  meetingId: string,
  file: File,
  onProgress: (fraction: number) => void,
  options?: { journalEntryId?: string | null },
): Promise<{ id: string } | { error: string }> {
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return { error: "That file is too large (512 MB max)." };
  }
  const contentType = resolveContentType(file);
  if (!contentType) {
    return { error: "Use a photo (JPEG, PNG, WebP, HEIC) or video (MP4, MOV, WebM)." };
  }

  const scopeId = meetingId === "home" || meetingId === HOME_UPLOAD_SCOPE ? HOME_UPLOAD_SCOPE : meetingId;
  const ticketResponse = await fetch("/api/storage/media/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      meetingId: scopeId,
      fileName: file.name,
      size: file.size,
      contentType,
    }),
  });
  const ticket = (await ticketResponse.json().catch(() => null)) as {
    url?: string;
    key?: string;
    contentType?: string;
    error?: string;
  } | null;
  if (!ticketResponse.ok || !ticket?.url || !ticket.key || !ticket.contentType) {
    return {
      error:
        ticket?.error ??
        (ticketResponse.status === 401 || ticketResponse.status === 403
          ? "Sign in first."
          : "The file did not upload. Try again."),
    };
  }

  const ok = await putWithProgress(ticket.url, ticket.contentType, file, onProgress);
  if (!ok) {
    return { error: "The file did not upload. Try again. If this keeps happening, ask a coach." };
  }

  const result = await saveMeetingMedia({
    meetingId: scopeId,
    objectKey: ticket.key,
    contentType: ticket.contentType,
    size: file.size,
    fileName: file.name,
    journalEntryId: options?.journalEntryId,
  });
  if ("error" in result && result.error) {
    return { error: result.error };
  }
  if (!("id" in result) || !result.id) {
    return { error: "The file did not upload. Try again." };
  }
  return { id: result.id };
}
