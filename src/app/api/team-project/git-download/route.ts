import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { buildGitRepoZip } from "@/lib/team-project";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let session: Awaited<ReturnType<typeof auth.api.getSession>>;
  try {
    session = await auth.api.getSession({ headers: request.headers });
  } catch (error) {
    console.error("Team project git download session failed", error);
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (session.user.mustChangePassword) {
    return NextResponse.json(
      { error: "Set a new password before downloading." },
      { status: 403 },
    );
  }
  if (session.user.role !== "coach") {
    return NextResponse.json(
      { error: "Only coaches can download the full Git repo." },
      { status: 403 },
    );
  }

  try {
    const result = await buildGitRepoZip();
    if (!result.ok) {
      if (result.error === "storage") {
        return NextResponse.json(
          { error: "File saving is not set up yet." },
          { status: 400 },
        );
      }
      if (result.error === "not_seeded") {
        return NextResponse.json(
          {
            error:
              "No Git history yet. Wait until someone uploads the first project zip.",
          },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "The Git repo zip is missing from storage. Ask another coach." },
        { status: 404 },
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/zip");
    headers.set(
      "Content-Disposition",
      `attachment; filename="${result.fileName}"`,
    );
    headers.set("Cache-Control", "no-store");
    headers.set("X-Team-Project-Sha", result.headSha);
    return new NextResponse(new Uint8Array(result.bytes), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Team project git download failed", error);
    return NextResponse.json(
      { error: "Could not download the Git repo. Try again." },
      { status: 500 },
    );
  }
}
