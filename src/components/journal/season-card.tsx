import { X } from "lucide-react";
import { cn } from "cn";

import { SeasonDateForm } from "@/components/journal/season-date-form";
import { removeSeasonDate } from "@/lib/actions";
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
  const hereIndex = chosen.filter((point) => point.dayKey <= today).length;
  const items: (SeasonPoint | { key: "here" })[] = [
    ...chosen.slice(0, hereIndex),
    { key: "here" },
    ...chosen.slice(hereIndex),
  ];
  // Each point sits at the start of an equal column, so point i is at i / n of the width.
  const trackEnd = (items.length - 1) / items.length;
  const fillEnd = hereIndex / items.length;
  const events = points.filter((point) => point.kind === "event");

  return (
    <section
      aria-labelledby="season-heading"
      className="flex flex-col gap-5 rounded-3xl bg-card p-5 ring-1 ring-line sm:p-6"
    >
      <h2 id="season-heading" className="text-xl font-semibold">
        Season so far
      </h2>

      <div className="overflow-x-auto pb-1">
        <div className="relative min-w-[560px] pt-1.5">
          <div
            aria-hidden
            className="absolute top-4 left-2.5 h-1 rounded bg-[#ECE8DF]"
            style={{ width: `calc(100% * ${trackEnd})` }}
          />
          <div
            aria-hidden
            className="absolute top-4 left-2.5 h-1 rounded bg-primary"
            style={{ width: `calc(100% * ${fillEnd})` }}
          />
          <ol
            className="relative grid gap-2"
            style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
          >
            {items.map((item, index) => {
              if (item.key === "here") {
                return (
                  <li key="here" className="flex min-w-0 flex-col gap-1.5">
                    <span className="size-5 rounded-full border-4 border-primary bg-card shadow-[0_0_0_4px_var(--color-brand-tint)]" />
                    <span className="font-mono text-[13px] font-semibold text-primary">
                      {labelFor(today)}
                    </span>
                    <span className="text-base leading-tight font-semibold text-primary">
                      We are here
                    </span>
                  </li>
                );
              }
              const point = item as SeasonPoint;
              const past = index < hereIndex;
              return (
                <li key={point.key} className="flex min-w-0 flex-col gap-1.5">
                  <span
                    className={cn(
                      "size-5 rounded-full",
                      past
                        ? "bg-primary shadow-[0_0_0_4px_var(--color-card)]"
                        : "border-2 border-dashed border-foreground/35 bg-card",
                    )}
                  />
                  <span className="font-mono text-[13px] text-muted-foreground">
                    {labelFor(point.dayKey)}
                  </span>
                  <span
                    className={cn(
                      "text-base leading-tight",
                      past ? "font-semibold" : "font-medium text-muted-foreground",
                    )}
                  >
                    {point.label}
                  </span>
                </li>
              );
            })}
          </ol>
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
