import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { buildDownloadZip } from "@/lib/team-project";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let session: Awaited<ReturnType<typeof auth.api.getSession>>;
  try {
    session = await auth.api.getSession({ headers: request.headers });
  } catch (error) {
    console.error("Team project download session failed", error);
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session.user.mustChangePassword) {
    return NextResponse.redirect(new URL("/set-password", request.url));
  }

  try {
    const { bytes, headSha, fileName } = await buildDownloadZip();
    const headers = new Headers();
    headers.set("Content-Type", "application/zip");
    headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
    headers.set("Cache-Control", "no-store");
    if (headSha) {
      headers.set("X-Team-Project-Sha", headSha);
    }
    return new NextResponse(new Uint8Array(bytes), { status: 200, headers });
  } catch (error) {
    console.error("Team project download failed", error);
    return NextResponse.json(
      { error: "Could not build the project zip. Ask a coach." },
      { status: 500 },
    );
  }
}
