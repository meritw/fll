/**
 * Layout for the journal's "Season so far" strip: every point sits at its real date, so the
 * gap between two dots is the time between them and "today" shows how far through we are.
 * Pure date math on YYYY-MM-DD team date keys, no React.
 */

export type TimelinePointInput = {
  key: string;
  dayKey: string;
  label: string;
  kind: "milestone" | "event";
};

export type TimelineMark = TimelinePointInput & {
  /** 0–1 across the axis. */
  at: number;
  past: boolean;
  /** Label row under the track, or null when there is no room (dot only). */
  lane: number | null;
  /** Labels near the right edge hang leftward from their dot. */
  align: "start" | "end";
};

export type SeasonTimeline = {
  startDay: string;
  endDay: string;
  todayAt: number;
  /** "We are here" always gets a label, on the first row. */
  todayLane: number;
  todayAlign: "start" | "end";
  /** Set when a future season date gives the season an end. */
  progress: { percent: number; weeksLeft: number; endLabel: string } | null;
  /** 1-based week of the season that today falls in. */
  week: number;
  marks: TimelineMark[];
  months: { key: string; label: string; at: number }[];
  laneCount: number;
};

/** Label width as a share of the axis. Sized for the strip's 720px minimum width. */
export const LABEL_SPAN = 0.17;
export const MAX_LANES = 3;
/** With no end date yet, leave this much room past today so the marker isn't on the edge. */
const OPEN_END_DAYS = 21;

const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Whole days since 1970-01-01 for a YYYY-MM-DD key; calendar days, no time zone involved. */
export function dayNumber(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

function dayKeyOf(dayNum: number) {
  return new Date(dayNum * DAY_MS).toISOString().slice(0, 10);
}

type Span = { from: number; to: number };

/** Give each label, in the order given, the first row where it overlaps nothing already placed. */
export function assignLanes(spans: Span[], maxLanes = MAX_LANES) {
  const rows: Span[][] = Array.from({ length: maxLanes }, () => []);
  return spans.map((span) => {
    const lane = rows.findIndex((row) => row.every((taken) => taken.to <= span.from || span.to <= taken.from));
    if (lane === -1) return null;
    rows[lane].push(span);
    return lane;
  });
}

function labelSpan(position: number) {
  const align: "start" | "end" = position + LABEL_SPAN > 1 ? "end" : "start";
  return {
    align,
    from: align === "start" ? position : position - LABEL_SPAN,
    to: align === "start" ? position + LABEL_SPAN : position,
  };
}

export function buildSeasonTimeline({
  points,
  today,
  firstMeetingDay,
}: {
  points: TimelinePointInput[];
  today: string;
  /** The earliest meeting on record; the season starts there unless a point is earlier. */
  firstMeetingDay?: string | null;
}): SeasonTimeline {
  const sorted = [...points].sort((left, right) => left.dayKey.localeCompare(right.dayKey));
  const todayNum = dayNumber(today);

  const startNum = Math.min(
    todayNum,
    ...(firstMeetingDay ? [dayNumber(firstMeetingDay)] : []),
    ...sorted.map((point) => dayNumber(point.dayKey)),
  );
  // The last coach-set date still to come (the qualifier, usually) is the finish line.
  const finish = sorted.filter((point) => point.kind === "event" && point.dayKey > today).at(-1);
  const lastPointNum = sorted.length ? dayNumber(sorted.at(-1)!.dayKey) : todayNum;
  const endNum = finish
    ? dayNumber(finish.dayKey)
    : Math.max(lastPointNum, todayNum + OPEN_END_DAYS);
  const span = Math.max(endNum - startNum, 1);
  const at = (dayNum: number) => (dayNum - startNum) / span;

  const todayAt = at(todayNum);
  const todaySpan = labelSpan(todayAt);
  const placed = sorted.map((point) => {
    const position = at(dayNumber(point.dayKey));
    return { point, position, ...labelSpan(position) };
  });
  // Today first so it always lands on row 0; points then fill around it.
  const [todayLane, ...lanes] = assignLanes([todaySpan, ...placed]);
  const marks: TimelineMark[] = placed.map(({ point, position, align }, index) => ({
    ...point,
    at: position,
    past: point.dayKey <= today,
    lane: lanes[index],
    align,
  }));

  const months: SeasonTimeline["months"] = [];
  const startDate = new Date(startNum * DAY_MS);
  for (
    let cursor = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1);
    cursor / DAY_MS <= endNum;
    cursor = Date.UTC(new Date(cursor).getUTCFullYear(), new Date(cursor).getUTCMonth() + 1, 1)
  ) {
    const date = new Date(cursor);
    months.push({
      key: date.toISOString().slice(0, 7),
      label: MONTHS[date.getUTCMonth()],
      at: at(Math.round(cursor / DAY_MS)),
    });
  }

  return {
    startDay: dayKeyOf(startNum),
    endDay: dayKeyOf(endNum),
    todayAt,
    todayLane: todayLane ?? 0,
    todayAlign: todaySpan.align,
    progress: finish
      ? {
          percent: Math.round(todayAt * 100),
          weeksLeft: Math.ceil((endNum - todayNum) / 7),
          endLabel: finish.label,
        }
      : null,
    week: Math.floor((todayNum - startNum) / 7) + 1,
    marks,
    months,
    laneCount: Math.max(1, ...lanes.map((lane) => (lane ?? -1) + 1)),
  };
}
