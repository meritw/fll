import { TEAM_TIME_ZONE } from "@/lib/timezone";

const weekdayFmt = new Intl.DateTimeFormat("en-US", { timeZone: TEAM_TIME_ZONE, weekday: "short" });
const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: TEAM_TIME_ZONE, day: "numeric" });
const monthShortFmt = new Intl.DateTimeFormat("en-US", { timeZone: TEAM_TIME_ZONE, month: "short" });
const monthLongFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TEAM_TIME_ZONE,
  month: "long",
  year: "numeric",
});
const shortDateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TEAM_TIME_ZONE,
  month: "short",
  day: "numeric",
});
const longDayFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TEAM_TIME_ZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TEAM_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});
const monthKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TEAM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
});

export function dayParts(value: Date) {
  return {
    weekday: weekdayFmt.format(value).toUpperCase(),
    day: dayFmt.format(value),
    month: monthShortFmt.format(value).toUpperCase(),
  };
}

/** "2026-10" in the team time zone. */
export function monthKey(value: Date) {
  return monthKeyFmt.format(value).slice(0, 7);
}

export function monthLabel(value: Date) {
  return monthLongFmt.format(value);
}

export function shortDate(value: Date) {
  return shortDateFmt.format(value);
}

export function longDay(value: Date) {
  return longDayFmt.format(value);
}

export function timeOfDay(value: Date) {
  return timeFmt.format(value);
}

export function sessionLabel(sessionNumber: number | null) {
  return sessionNumber != null ? `Session ${sessionNumber}` : "Session";
}

const DEFAULT_TITLE = "team meeting";

export function truncate(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Coach title, else first progress note, else "Session N". */
export function meetingHeadline(input: {
  title: string | null;
  sessionNumber: number | null;
  progress: { body: string }[];
}) {
  const title = input.title?.trim();
  if (title && title.toLowerCase() !== DEFAULT_TITLE) {
    return title;
  }
  const first = input.progress[0]?.body;
  if (first?.trim()) {
    return truncate(first, 80);
  }
  return sessionLabel(input.sessionNumber);
}

export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

const weekdayDateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TEAM_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function weekdayDate(value: Date) {
  return weekdayDateFmt.format(value);
}
