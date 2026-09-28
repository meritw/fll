import { NextRequest, NextResponse } from "next/server";

import {
  authorizeMeetingsIcs,
  buildMeetingsIcs,
  meetingsIcsEtag,
  meetingsIcsToken,
  publicSiteOrigin,
} from "@/lib/ics";
import { listMeetingsForCalendar } from "@/lib/meetings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!authorizeMeetingsIcs(token)) {
    return new NextResponse("Calendar feed token required.", {
      status: 401,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const meetings = await listMeetingsForCalendar();
  const body = buildMeetingsIcs(meetings, publicSiteOrigin());
  const etag = meetingsIcsEtag(meetings);

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  // When a token is configured, discourage shared caches from storing the secret URL response.
  const cacheControl = meetingsIcsToken()
    ? "private, max-age=300"
    : "public, max-age=300";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="rolling-sparks-meetings.ics"',
      "Cache-Control": cacheControl,
      ETag: etag,
    },
  });
}
