import { auth } from "@/lib/auth";
import { getMeetingMediaFile } from "@/lib/media";
import { openStorageObject } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Parse a single HTTP bytes Range against a known size.
 * Multi-range requests are ignored (full body) — Safari/iOS send one range.
 */
function parseBytesRange(
  rangeHeader: string | null,
  size: number,
):
  | { kind: "full" }
  | { kind: "partial"; start: number; end: number }
  | { kind: "unsatisfiable" } {
  if (!rangeHeader || size <= 0) {
    return { kind: "full" };
  }
  const match = /^bytes\s*=\s*(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    // Unsupported unit or multi-range — serve the full object.
    return { kind: "full" };
  }

  const startToken = match[1];
  const endToken = match[2];

  if (startToken === "" && endToken === "") {
    return { kind: "full" };
  }

  // Suffix: last N bytes (`bytes=-500`)
  if (startToken === "") {
    const suffix = Number(endToken);
    if (!Number.isFinite(suffix) || suffix <= 0) {
      return { kind: "unsatisfiable" };
    }
    const start = Math.max(0, size - suffix);
    return { kind: "partial", start, end: size - 1 };
  }

  const start = Number(startToken);
  if (!Number.isFinite(start) || start < 0 || start >= size) {
    return { kind: "unsatisfiable" };
  }

  // Open end (`bytes=500-`) or closed (`bytes=0-1`)
  const end =
    endToken === ""
      ? size - 1
      : Math.min(Number(endToken), size - 1);
  if (!Number.isFinite(end) || end < start) {
    return { kind: "unsatisfiable" };
  }

  return { kind: "partial", start, end };
}

function mediaHeaders(media: {
  contentType: string;
  fileName: string;
}): Record<string, string> {
  return {
    "Content-Type": media.contentType,
    "Content-Disposition": `inline; filename="${media.fileName.replace(/"/g, "")}"`,
    // Auth-gated; UUID URLs are immutable once uploaded. Longer private cache
    // cuts repeat media hits when scrolling gallery/journal on phones.
    "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
    "Accept-Ranges": "bytes",
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.redirect(new URL("/login", request.url));
  }
  if (session.user.mustChangePassword) {
    return Response.redirect(new URL("/set-password", request.url));
  }
  if (session.user.mustSetDisplayName) {
    return Response.redirect(new URL("/set-name", request.url));
  }

  const { id } = await context.params;
  const media = await getMeetingMediaFile(id);
  if (!media) {
    return new Response("That file is missing.", { status: 404 });
  }

  const size = media.size;
  const range = parseBytesRange(request.headers.get("range"), size);

  if (range.kind === "unsatisfiable") {
    return new Response(null, {
      status: 416,
      headers: {
        ...mediaHeaders(media),
        "Content-Range": `bytes */${size}`,
      },
    });
  }

  try {
    if (range.kind === "partial") {
      const byteRange = `bytes=${range.start}-${range.end}`;
      const opened = await openStorageObject(media.objectKey, { range: byteRange });
      if (!opened) {
        return new Response("That file is missing.", { status: 404 });
      }

      const contentLength =
        opened.contentLength ?? range.end - range.start + 1;
      const contentRange =
        opened.contentRange ?? `bytes ${range.start}-${range.end}/${size}`;

      return new Response(opened.stream, {
        status: 206,
        headers: {
          ...mediaHeaders(media),
          "Content-Length": String(contentLength),
          "Content-Range": contentRange,
        },
      });
    }

    const opened = await openStorageObject(media.objectKey);
    if (!opened) {
      return new Response("That file is missing.", { status: 404 });
    }

    return new Response(opened.stream, {
      status: 200,
      headers: {
        ...mediaHeaders(media),
        "Content-Length": String(opened.contentLength ?? size),
      },
    });
  } catch (error) {
    console.error("Media download failed", error);
    return new Response("That file is missing.", { status: 404 });
  }
}
