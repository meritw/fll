import { parseTeamDateKey } from "@/lib/timezone";

/**
 * Rolling Sparks 2026–27 FLL Challenge season axis (team calendar dates).
 *
 * - Start: official BIOGLOW challenge release (worldwide kickoff for building).
 * - End: end of the calendar year — wraps the typical regional competition window
 *   for this team (meetings are seeded through Dec 5; see journal-revamp-handoff).
 *   Not a championship final date; coaches can still plot later season events and
 *   the strip axis extends to include them.
 */
export const SEASON_START_DAY = "2026-08-04";
export const SEASON_END_DAY = "2026-12-31";

/**
 * Soft minimum gap between marks as a fraction of the axis.
 * Kept small so a ~1-week calendar gap still reads larger than consecutive days
 * on a full Aug→Dec season (~150 days); the strip scrolls horizontally for labels.
 */
export const SEASON_MARK_MIN_GAP = 0.02;

/** Calendar-day index for a YYYY-MM-DD key (UTC midnight of that civil date). */
export function dayIndex(dayKey: string): number {
  const parts = parseTeamDateKey(dayKey);
  if (!parts) return Number.NaN;
  return Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000;
}

/** Inclusive day span between two YYYY-MM-DD keys (0 if invalid / reversed). */
export function daySpan(startDay: string, endDay: string): number {
  const start = dayIndex(startDay);
  const end = dayIndex(endDay);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return end - start;
}

/**
 * Position of a day on [axisStart, axisEnd], clamped to 0..1.
 * Equal calendar gaps → equal position gaps (before readability nudging).
 */
export function seasonFraction(
  dayKey: string,
  axisStart: string = SEASON_START_DAY,
  axisEnd: string = SEASON_END_DAY,
): number {
  const t = dayIndex(dayKey);
  const a = dayIndex(axisStart);
  const b = dayIndex(axisEnd);
  if (!Number.isFinite(t) || !Number.isFinite(a) || !Number.isFinite(b) || b <= a) {
    return 0;
  }
  return Math.min(1, Math.max(0, (t - a) / (b - a)));
}

/**
 * Axis range for the strip: documented season bounds, expanded if any mark
 * (or today) falls outside so nothing is clipped off the ends.
 */
export function seasonAxisRange(
  dayKeys: string[],
  seasonStart: string = SEASON_START_DAY,
  seasonEnd: string = SEASON_END_DAY,
): { start: string; end: string } {
  let start = seasonStart;
  let end = seasonEnd;
  for (const key of dayKeys) {
    if (!parseTeamDateKey(key)) continue;
    if (key < start) start = key;
    if (key > end) end = key;
  }
  if (end < start) return { start: seasonStart, end: seasonEnd };
  return { start, end };
}

/**
 * Push marks apart when they would sit closer than `minGap`, then compress
 * back into 0..1 if needed. Order is preserved; large calendar gaps stay
 * visibly larger than consecutive-day clusters.
 */
export function nudgeFractions(raw: number[], minGap: number = SEASON_MARK_MIN_GAP): number[] {
  if (raw.length === 0) return [];
  const positions = raw.map((value) => Math.min(1, Math.max(0, value)));
  for (let i = 1; i < positions.length; i++) {
    if (positions[i]! < positions[i - 1]! + minGap) {
      positions[i] = positions[i - 1]! + minGap;
    }
  }
  const last = positions[positions.length - 1]!;
  if (last <= 1 || positions.length === 1) {
    return positions.map((value) => Math.min(1, value));
  }
  // Overflow: keep the first mark, scale the rest so the last lands on 1.
  const first = positions[0]!;
  const span = last - first;
  if (span <= 0) return positions.map(() => first);
  return positions.map((value) => first + ((value - first) / span) * (1 - first));
}

export type SeasonMarkLayout = {
  key: string;
  dayKey: string;
  /** 0..1 along the season axis after readability nudging. */
  left: number;
  /** True calendar fraction before nudging (for tests / debugging). */
  rawLeft: number;
};

/**
 * Lay out unique day markers on the season axis. Same-day items share one
 * slot (caller stacks their labels). `today` is included so "We are here"
 * sits on the real calendar position.
 */
export function layoutSeasonMarks(
  dayKeys: string[],
  today: string,
  options?: {
    seasonStart?: string;
    seasonEnd?: string;
    minGap?: number;
  },
): {
  axisStart: string;
  axisEnd: string;
  todayLeft: number;
  todayRawLeft: number;
  progress: number;
  marks: SeasonMarkLayout[];
} {
  const unique = [...new Set([...dayKeys, today].filter((key) => Boolean(parseTeamDateKey(key))))].sort(
    (left, right) => left.localeCompare(right),
  );
  const { start: axisStart, end: axisEnd } = seasonAxisRange(
    unique,
    options?.seasonStart ?? SEASON_START_DAY,
    options?.seasonEnd ?? SEASON_END_DAY,
  );
  const raw = unique.map((dayKey) => seasonFraction(dayKey, axisStart, axisEnd));
  const nudged = nudgeFractions(raw, options?.minGap ?? SEASON_MARK_MIN_GAP);
  const marks = unique.map((dayKey, index) => ({
    key: dayKey,
    dayKey,
    left: nudged[index]!,
    rawLeft: raw[index]!,
  }));
  const todayIndex = unique.indexOf(today);
  const todayLeft = todayIndex >= 0 ? nudged[todayIndex]! : seasonFraction(today, axisStart, axisEnd);
  const todayRawLeft =
    todayIndex >= 0 ? raw[todayIndex]! : seasonFraction(today, axisStart, axisEnd);
  // Progress uses the true calendar fraction on the (possibly extended) axis.
  const progress = seasonFraction(today, axisStart, axisEnd);
  return { axisStart, axisEnd, todayLeft, todayRawLeft, progress, marks };
}
