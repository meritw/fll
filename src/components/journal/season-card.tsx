import { X } from "lucide-react";
import { cn } from "cn";

import { SeasonDateForm } from "@/components/journal/season-date-form";
import { removeSeasonDate } from "@/lib/actions";
import { buildSeasonTimeline, LABEL_SPAN } from "@/lib/season-timeline";
import { parseTeamDateKey, TEAM_TIME_ZONE, zonedDateTime } from "@/lib/timezone";

export type SeasonPoint = {
  key: string;
  dayKey: string;
  label: string;
  kind: "milestone" | "event";
  /** Season events can be removed by coaches. */
  eventId?: string;
};

const shortDate = new Intl.DateTimeFormat("en-US", {
  timeZone: TEAM_TIME_ZONE,
  month: "short",
  day: "numeric",
});

function labelFor(dayKey: string) {
  const parts = parseTeamDateKey(dayKey);
  if (!parts) return dayKey;
  return shortDate.format(zonedDateTime(parts.year, parts.month, parts.day, 12, 0)).toUpperCase();
}

// Vertical layout of the strip, in px: month labels, then the track, then label rows.
const TRACK_Y = 36;
const LANE_TOP = TRACK_Y + 20;
const LANE_HEIGHT = 50;

const pct = (at: number) => `${at * 100}%`;

/** Places a label at its dot: hanging right from it, or left near the strip's end. */
function labelStyle(at: number, align: "start" | "end", lane: number) {
  return {
    left: pct(at),
    top: LANE_TOP + lane * LANE_HEIGHT,
    // The same share of the strip the overlap check reserved, so wide screens get wide labels.
    width: pct(LABEL_SPAN),
    transform: align === "start" ? "translateX(-10px)" : "translateX(calc(-100% + 10px))",
  };
}

function plural(count: number, one: string) {
  return `${count} ${count === 1 ? one : `${one}s`}`;
}

export function SeasonCard({
  points,
  today,
  firstMeetingDay,
  stats,
  coach,
}: {
  points: SeasonPoint[];
  today: string;
  firstMeetingDay: string | null;
  stats: { value: string; label: string }[];
  coach: boolean;
}) {
  const timeline = buildSeasonTimeline({ points, today, firstMeetingDay });
  const { progress } = timeline;
  const events = points.filter((point) => point.kind === "event");
  const next = timeline.marks.find((mark) => !mark.past);
  const summary = progress
    ? `Week ${timeline.week} · ${progress.percent}% of the way to ${progress.endLabel} · ${plural(progress.weeksLeft, "week")} to go`
    : `Week ${timeline.week} of the season`;

  return (
    <section
      aria-labelledby="season-heading"
      className="flex flex-col gap-5 rounded-3xl bg-card p-5 ring-1 ring-line sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="season-heading" className="text-xl font-semibold">
          Season so far
        </h2>
        <p className="text-base text-muted-foreground">{summary}</p>
      </div>

      {/* Phones: a plain progress bar; the labelled strip needs more width. */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="relative h-5" aria-hidden>
          <div className="absolute inset-x-0 top-2 h-1.5 rounded-full bg-status-none" />
          <div
            className="absolute top-2 left-0 h-1.5 rounded-full bg-primary"
            style={{ width: pct(timeline.todayAt) }}
          />
          {timeline.marks.map((mark) => (
            <span
              key={mark.key}
              className={cn(
                "absolute top-1 size-3.5 -translate-x-1/2 rounded-full",
                mark.past ? "bg-primary ring-2 ring-card" : "border-2 border-dashed border-foreground/35 bg-card",
              )}
              style={{ left: pct(mark.at) }}
            />
          ))}
          <span
            className="absolute top-0 size-5 -translate-x-1/2 rounded-full border-4 border-primary bg-card"
            style={{ left: pct(timeline.todayAt) }}
          />
        </div>
        {next ? (
          <p className="text-base">
            <span className="font-semibold">Next:</span> {next.label} ·{" "}
            <span className="font-mono text-sm text-muted-foreground">{labelFor(next.dayKey)}</span>
          </p>
        ) : null}
      </div>

      {/* Wider screens: every point at its real date, so the spacing is the time between them. */}
      <div className="hidden overflow-x-auto pb-1 sm:block">
        <div
          className="relative mx-2.5 min-w-[720px]"
          style={{ height: LANE_TOP + timeline.laneCount * LANE_HEIGHT }}
        >
          {timeline.months.map((month) => (
            <div
              key={month.key}
              aria-hidden
              className="absolute top-0 flex flex-col items-center"
              style={{ left: pct(month.at), transform: "translateX(-50%)" }}
            >
              <span className="font-mono text-xs text-muted-foreground uppercase">{month.label}</span>
              <span className="h-[18px] w-px bg-line" />
            </div>
          ))}
          <div
            aria-hidden
            className="absolute inset-x-0 h-1.5 -translate-y-1/2 rounded-full bg-status-none"
            style={{ top: TRACK_Y }}
          />
          <div
            aria-hidden
            className="absolute left-0 h-1.5 -translate-y-1/2 rounded-full bg-primary"
            style={{ top: TRACK_Y, width: pct(timeline.todayAt) }}
          />

          <ol aria-label="Season dates">
            {timeline.marks.map((mark) => (
              <li key={mark.key}>
                <span
                  aria-hidden
                  className={cn(
                    "absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full",
                    mark.past
                      ? "bg-primary ring-2 ring-card"
                      : "border-2 border-dashed border-foreground/35 bg-card",
                  )}
                  style={{ left: pct(mark.at), top: TRACK_Y }}
                />
                {mark.lane === null ? (
                  <span className="sr-only">
                    {labelFor(mark.dayKey)}: {mark.label}
                  </span>
                ) : (
                  <>
                    <span
                      aria-hidden
                      className="absolute w-px -translate-x-1/2 bg-line"
                      style={{
                        left: pct(mark.at),
                        top: TRACK_Y + 10,
                        height: LANE_TOP - TRACK_Y - 10 + mark.lane * LANE_HEIGHT,
                      }}
                    />
                    <span
                      className={cn(
                        "absolute flex flex-col",
                        mark.align === "end" && "items-end text-right",
                      )}
                      style={labelStyle(mark.at, mark.align, mark.lane)}
                      title={mark.label}
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {labelFor(mark.dayKey)}
                      </span>
                      <span
                        className={cn(
                          "max-w-full truncate text-base leading-tight",
                          mark.past ? "font-semibold" : "font-medium text-muted-foreground",
                        )}
                      >
                        {mark.label}
                      </span>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ol>

          <span
            aria-hidden
            className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-primary bg-card shadow-[0_0_0_4px_var(--color-brand-tint)]"
            style={{ left: pct(timeline.todayAt), top: TRACK_Y }}
          />
          <span
            className={cn(
              "absolute flex flex-col text-primary",
              timeline.todayAlign === "end" && "items-end text-right",
            )}
            style={labelStyle(timeline.todayAt, timeline.todayAlign, timeline.todayLane)}
          >
            <span className="font-mono text-xs font-semibold">{labelFor(today)}</span>
            <span className="text-base leading-tight font-semibold">We are here</span>
          </span>
        </div>
      </div>
      {points.length === 0 ? (
        <p className="text-base text-muted-foreground">
          Milestones and big dates show up here as the season goes.
          {coach ? " Add the scrimmage and qualifier dates below." : ""}
        </p>
      ) : !progress && coach ? (
        <p className="text-base text-muted-foreground">
          Add the qualifier date below to see how far through the season we are.
        </p>
      ) : null}

      <dl className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 border-t border-line pt-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse">
            <dt className="text-base text-muted-foreground">{stat.label}</dt>
            <dd className="text-3xl leading-tight font-bold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {coach ? (
        <details className="rounded-2xl bg-paper px-4 py-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold">
            Season dates (coaches)
          </summary>
          <div className="flex flex-col gap-3 pb-3">
            {events.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {events.map((event) => (
                  <li key={event.key} className="flex items-center justify-between gap-2">
                    <span>
                      {event.label} · {labelFor(event.dayKey)}
                    </span>
                    <form action={removeSeasonDate}>
                      <input type="hidden" name="id" value={event.eventId} />
                      <button
                        type="submit"
                        aria-label={`Remove ${event.label}`}
                        className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-muted"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : null}
            <SeasonDateForm />
          </div>
        </details>
      ) : null}
    </section>
  );
}
