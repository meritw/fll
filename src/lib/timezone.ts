/** Team evenings are scheduled in America/New_York (Eastern). */

export const TEAM_TIME_ZONE = "America/New_York";

/** Short label for meeting times in UI copy. */
export const TEAM_TIME_ZONE_ABBR = "ET";

const datePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TEAM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  weekday: "short",
});

function partsMap(value: Date) {
  const parts = datePartsFormatter.formatToParts(value);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  return map;
}

/** Calendar date string YYYY-MM-DD in the team timezone. */
export function teamDateKey(value: Date) {
  const map = partsMap(value);
  return `${map.year}-${map.month}-${map.day}`;
}

export function teamWeekday(value: Date) {
  return partsMap(value).weekday;
}

/**
 * Build a Date for a wall-clock time in America/New_York.
 * Uses a short UTC probe then corrects the offset (handles EST/EDT).
 */
export function zonedDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const map = partsMap(guess);
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour === "24" ? "0" : map.hour),
    Number(map.minute),
  );
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
  return new Date(guess.getTime() + (desired - asUtc));
}

export function parseTeamDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { year, month, day };
}

export function formatMeetingWhen(startsAt: Date, endsAt: Date) {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: TEAM_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(startsAt);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: TEAM_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} · ${time.format(startsAt)}–${time.format(endsAt)} ${TEAM_TIME_ZONE_ABBR}`;
}

export function formatTeamStamp(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TEAM_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export function formatTeamDay(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TEAM_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(value);
}
