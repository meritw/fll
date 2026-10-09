import { X } from "lucide-react";
import { cn } from "cn";

import { SeasonDateForm } from "@/components/journal/season-date-form";
import { removeSeasonDate } from "@/lib/actions";
import {
  daySpan,
  layoutSeasonMarks,
  SEASON_END_DAY,
  SEASON_START_DAY,
} from "@/lib/season";
import { parseTeamDateKey, TEAM_TIME_ZONE, zonedDateTime } from "@/lib/timezone";

export type SeasonPoint = {
  key: string;
  dayKey: string;
  label: string;
  kind: "milestone" | "event";
  /** Season events can be removed by coaches. */
  eventId?: string;
};

const MAX_POINTS = 6;

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

/** Pick what fits on the strip: every upcoming date, then the most recent past ones. */
function choosePoints(points: SeasonPoint[], today: string) {
  const sorted = [...points].sort((left, right) => left.dayKey.localeCompare(right.dayKey));
  const future = sorted.filter((point) => point.dayKey > today).slice(0, MAX_POINTS - 2);
  const past = sorted.filter((point) => point.dayKey <= today);
  return [...past.slice(-(MAX_POINTS - future.length)), ...future];
}

function progressLabel(progress: number) {
  const pct = Math.round(progress * 100);
  if (pct <= 0) return "Season just starting";
  if (pct >= 100) return "Season complete";
  return `${pct}% through the season`;
}

export function SeasonCard({
  points,
  today,
  stats,
  coach,
}: {
  points: SeasonPoint[];
  today: string;
  stats: { value: string; label: string }[];
  coach: boolean;
}) {
  const chosen = choosePoints(points, today);
  const layout = layoutSeasonMarks(
    chosen.map((point) => point.dayKey),
    today,
  );
  const byDay = new Map<string, SeasonPoint[]>();
  for (const point of chosen) {
    const list = byDay.get(point.dayKey) ?? [];
    list.push(point);
    byDay.set(point.dayKey, list);
  }
  const events = points.filter((point) => point.kind === "event");
  const axisDays = Math.max(1, daySpan(layout.axisStart, layout.axisEnd));
  // ~10px per calendar day so a week gap is visibly wider than a 1-day gap when scrolling.
  const trackMinWidth = Math.max(560, Math.round(axisDays * 10));

  return (
    <section
      aria-labelledby="season-heading"
      className="flex flex-col gap-5 rounded-3xl bg-card p-5 ring-1 ring-line sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="season-heading" className="text-xl font-semibold">
          Season so far
        </h2>
        <p className="font-mono text-sm text-primary" aria-live="polite">
          {progressLabel(layout.progress)}
        </p>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="relative pt-1.5" style={{ minWidth: trackMinWidth }}>
          <div className="relative mx-3 h-[7.5rem]">
            <div
              aria-hidden
              className="absolute top-4 right-0 left-0 h-1 rounded bg-status-none"
            />
            <div
              aria-hidden
              className="absolute top-4 left-0 h-1 rounded bg-primary"
              style={{ width: `${layout.todayLeft * 100}%` }}
            />

            {layout.marks.map((mark) => {
              const dayPoints = byDay.get(mark.dayKey) ?? [];
              const isToday = mark.dayKey === today;
              const past = mark.dayKey < today;
              return (
                <div
                  key={mark.key}
                  className="absolute top-0 flex w-[5.5rem] -translate-x-1/2 flex-col items-center gap-1.5 text-center"
                  style={{ left: `${mark.left * 100}%` }}
                >
                  {isToday ? (
                    <span className="size-5 rounded-full border-4 border-primary bg-card shadow-[0_0_0_4px_var(--color-brand-tint)]" />
                  ) : (
                    <span
                      className={cn(
                        "size-5 rounded-full",
                        past
                          ? "bg-primary shadow-[0_0_0_4px_var(--color-card)]"
                          : "border-2 border-dashed border-foreground/35 bg-card",
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "font-mono text-[13px]",
                      isToday ? "font-semibold text-primary" : "text-muted-foreground",
                    )}
                  >
                    {labelFor(mark.dayKey)}
                  </span>
                  {isToday ? (
                    <span className="text-base leading-tight font-semibold text-primary">
                      We are here
                    </span>
                  ) : null}
                  {dayPoints.map((point) => (
                    <span
                      key={point.key}
                      className={cn(
                        "line-clamp-2 text-base leading-tight",
                        past || isToday
                          ? "font-semibold"
                          : "font-medium text-muted-foreground",
                      )}
                    >
                      {point.label}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="mt-1 flex justify-between gap-3 px-1 font-mono text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
            <span>
              Start · {labelFor(layout.axisStart)}
              {layout.axisStart === SEASON_START_DAY ? "" : " (extended)"}
            </span>
            <span>
              End · {labelFor(layout.axisEnd)}
              {layout.axisEnd === SEASON_END_DAY ? "" : " (extended)"}
            </span>
          </div>
        </div>
      </div>
      {points.length === 0 ? (
        <p className="text-base text-muted-foreground">
          Milestones and big dates show up here as the season goes.
          {coach ? " Add the scrimmage and qualifier dates below." : ""}
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
