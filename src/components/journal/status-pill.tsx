import { cn } from "cn";

import { MISSION_STATUS_CLASSES, MISSION_STATUS_LABELS, type MissionStatus } from "@/lib/mission-status";

export function StatusPill({ status, className }: { status: MissionStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center whitespace-nowrap rounded-full px-2.5 text-sm font-semibold",
        MISSION_STATUS_CLASSES[status],
        className,
      )}
    >
      {MISSION_STATUS_LABELS[status]}
    </span>
  );
}

/** Stacked bar: every / some / trying / none, sized by count. */
export function StatusBar({
  counts,
  className,
}: {
  counts: Record<MissionStatus, number>;
  className?: string;
}) {
  const parts = [
    { status: "every" as const, color: "bg-status-every" },
    { status: "some" as const, color: "bg-status-some" },
    { status: "trying" as const, color: "bg-status-trying" },
    { status: "none" as const, color: "bg-status-none" },
  ];
  return (
    <div className={cn("flex h-3.5 gap-0.5 overflow-hidden rounded-lg", className)} aria-hidden>
      {parts.map((part) =>
        counts[part.status] > 0 ? (
          <span key={part.status} className={part.color} style={{ flex: counts[part.status] }} />
        ) : null,
      )}
    </div>
  );
}

export function StatusLegend({ counts }: { counts: Record<MissionStatus, number> }) {
  const order: MissionStatus[] = ["every", "some", "trying", "none"];
  const swatch: Record<MissionStatus, string> = {
    every: "bg-status-every",
    some: "bg-status-some",
    trying: "bg-status-trying",
    none: "bg-status-none",
  };
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground/80">
      {order.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <span className={cn("size-3 rounded-sm", swatch[status])} aria-hidden />
          {counts[status]} {MISSION_STATUS_LABELS[status].toLowerCase()}
        </li>
      ))}
    </ul>
  );
}
