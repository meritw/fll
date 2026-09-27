import { createHash, timingSafeEqual } from "crypto";

import { TEAM_TIME_ZONE } from "@/lib/timezone";

const SITE_ORIGIN = "https://www.rollingsparks.org";

export type CalendarMeeting = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  title: string | null;
  sessionNumber: number | null;
  updatedAt: Date;
};

/** Public site origin used in ICS event links (canonical www host). */
export function publicSiteOrigin() {
  const fromEnv = process.env.BETTER_AUTH_URL?.replace(/\/$/, "");
  if (fromEnv) {
    return fromEnv;
  }
  return SITE_ORIGIN;
}

export function meetingsIcsToken() {
  const token = process.env.MEETINGS_ICS_TOKEN?.trim();
  return token || null;
}

/** True when the request may read the schedule-only feed. */
export function authorizeMeetingsIcs(provided: string | null) {
  const expected = meetingsIcsToken();
  if (!expected) {
    // No token configured: schedule-only feed is public (no notes/attendance/PII).
    return true;
  }
  if (!provided) {
    return false;
  }
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

/** Absolute subscribe URL shown on the Meetings page (includes token when set). */
export function meetingsIcsSubscribeUrl(origin?: string) {
  const base = `${(origin || publicSiteOrigin()).replace(/\/$/, "")}/api/meetings.ics`;
  const token = meetingsIcsToken();
  if (!token) {
    return base;
  }
  return `${base}?token=${encodeURIComponent(token)}`;
}

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

/** UTC stamp YYYYMMDDTHHMMSSZ */
function formatUtcStamp(value: Date) {
  const iso = value.toISOString();
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`;
}

function foldLine(line: string) {
  if (line.length <= 75) {
    return line;
  }
  const chunks: string[] = [];
  let remaining = line;
  chunks.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    chunks.push(` ${remaining.slice(0, 74)}`);
    remaining = remaining.slice(74);
  }
  return chunks.join("\r\n");
}

function eventSummary(meeting: CalendarMeeting) {
  if (meeting.sessionNumber != null) {
    return `Session ${meeting.sessionNumber}`;
  }
  const title = meeting.title?.trim();
  return title || "Team meeting";
}

function buildEvent(meeting: CalendarMeeting, siteOrigin: string) {
  const summary = eventSummary(meeting);
  const pageUrl = `${siteOrigin.replace(/\/$/, "")}/meetings/${meeting.id}`;
  // Description is schedule-only: title context + link. No notes, attendance, or PII.
  const description = [
    meeting.title?.trim() && meeting.sessionNumber != null ? meeting.title.trim() : null,
    `Meeting page: ${pageUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VEVENT",
    `UID:meeting-${meeting.id}@rollingsparks.org`,
    `DTSTAMP:${formatUtcStamp(new Date())}`,
    `DTSTART:${formatUtcStamp(meeting.startsAt)}`,
    `DTEND:${formatUtcStamp(meeting.endsAt)}`,
    `LAST-MODIFIED:${formatUtcStamp(meeting.updatedAt)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${pageUrl}`,
    "LOCATION:Rolling Sparks",
    "END:VEVENT",
  ];
  return lines.map(foldLine).join("\r\n");
}

/** Build a schedule-only VCALENDAR body from meeting rows. */
export function buildMeetingsIcs(meetings: CalendarMeeting[], siteOrigin = publicSiteOrigin()) {
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rolling Sparks//Meetings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Rolling Sparks Meetings",
    `X-WR-TIMEZONE:${TEAM_TIME_ZONE}`,
  ].map(foldLine);

  const events = meetings.map((meeting) => buildEvent(meeting, siteOrigin));
  return `${[...header, ...events, "END:VCALENDAR"].join("\r\n")}\r\n`;
}

/** Weak ETag so clients can revalidate when the schedule set changes. */
export function meetingsIcsEtag(meetings: CalendarMeeting[]) {
  const digest = createHash("sha256");
  for (const meeting of meetings) {
    digest.update(
      `${meeting.id}:${meeting.startsAt.toISOString()}:${meeting.endsAt.toISOString()}:${meeting.title ?? ""}:${meeting.sessionNumber ?? ""}:${meeting.updatedAt.toISOString()}\n`,
    );
  }
  return `"${digest.digest("hex").slice(0, 32)}"`;
}
