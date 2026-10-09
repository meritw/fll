import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getMeetingMediaFile } from "@/lib/media";
import { openStorageObject } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session.user.mustChangePassword) {
    return NextResponse.redirect(new URL("/set-password", request.url));
  }
  if (session.user.mustSetDisplayName) {
    return NextResponse.redirect(new URL("/set-name", request.url));
  }

  const { id } = await context.params;
  const media = await getMeetingMediaFile(id);
  if (!media) {
    return new Response("That file is missing.", { status: 404 });
  }

  try {
    const stream = await openStorageObject(media.objectKey);
    if (!stream) {
      return new Response("That file is missing.", { status: 404 });
    }

    return new Response(stream, {
      headers: {
        "Content-Type": media.contentType,
        "Content-Disposition": `inline; filename="${media.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Media download failed", error);
    return new Response("That file is missing.", { status: 404 });
  }
}
