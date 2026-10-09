import { cn } from "@/lib/utils";
import {
  MISSION_STATUS_LABELS,
  type MissionStatus,
} from "@/lib/mission-status";

export const STATUS_CLASSES: Record<MissionStatus, string> = {
  every: "bg-status-every text-status-every-fg",
  some: "bg-status-some text-status-some-fg",
  trying: "bg-status-trying text-status-trying-fg",
  none: "bg-status-none text-status-none-fg",
};

export function StatusPill({
  status,
  className,
  children,
}: {
  status: MissionStatus;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-3 py-0.5 text-sm font-medium",
        STATUS_CLASSES[status],
        className,
      )}
    >
      {children ?? MISSION_STATUS_LABELS[status]}
    </span>
  );
}
