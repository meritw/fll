import { STATUS_CLASSES } from "@/components/status-pill";
import {
  MISSION_STATUS_LABELS,
  type MissionStatus,
} from "@/lib/mission-status";
import { cn } from "@/lib/utils";

export type StatusCounts = Record<MissionStatus, number>;

const ORDER: MissionStatus[] = ["every", "some", "trying", "none"];

export function countStatuses(items: { status: MissionStatus }[]): StatusCounts {
  const counts: StatusCounts = { every: 0, some: 0, trying: 0, none: 0 };
  for (const item of items) {
    counts[item.status] += 1;
  }
  return counts;
}

export function MissionStatusBar({
  counts,
  className,
}: {
  counts: StatusCounts;
  className?: string;
}) {
  const total = ORDER.reduce((sum, status) => sum + counts[status], 0);
  const summary = ORDER.map((status) => `${counts[status]} ${MISSION_STATUS_LABELS[status]}`).join(", ");

  return (
    <div
      role="img"
      aria-label={`Mission status: ${summary}`}
      className={cn("flex h-3 w-full overflow-hidden rounded-full bg-status-none", className)}
    >
      {ORDER.map((status) =>
        counts[status] > 0 ? (
          <div
            key={status}
            className={cn("h-full", STATUS_CLASSES[status])}
            style={{ width: `${(counts[status] / Math.max(total, 1)) * 100}%` }}
          />
        ) : null,
      )}
    </div>
  );
}

export function MissionStatusLegend({ counts }: { counts: StatusCounts }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
      {ORDER.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              "inline-block size-3 rounded-full",
              STATUS_CLASSES[status],
              status === "none" ? "ring-1 ring-line" : "",
            )}
          />
          {MISSION_STATUS_LABELS[status]} · {counts[status]}
        </li>
      ))}
    </ul>
  );
}
