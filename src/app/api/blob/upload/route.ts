import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "File saving is not set up yet. Ask a coach." },
      { status: 400 },
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) {
          throw new Error("Sign in first.");
        }
        if (!pathname.toLowerCase().endsWith(".llsp3")) {
          throw new Error("Choose a .llsp3 file.");
        }
        return {
          addRandomSuffix: true,
          maximumSizeInBytes: 32 * 1024 * 1024,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The file did not upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
