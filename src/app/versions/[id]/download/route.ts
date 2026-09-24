import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { safeFileName } from "@/lib/format";
import { getVersionFile } from "@/lib/programs";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { id } = await context.params;
  const version = await getVersionFile(id);
  if (!version) {
    return new Response("That file is missing.", { status: 404 });
  }

  const result = await get(version.blobUrl, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return new Response("That file is missing.", { status: 404 });
  }

  const fileName = safeFileName(version.fileName);
  return new Response(result.stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
