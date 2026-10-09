export const MISSION_STATUSES = ["none", "trying", "some", "every"] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

export const MISSION_STATUS_LABELS: Record<MissionStatus, string> = {
  none: "Not yet",
  trying: "Trying",
  some: "Sometimes",
  every: "Every time",
};

export const MISSION_STATUS_HINTS: Record<MissionStatus, string> = {
  none: "Nobody has tried",
  trying: "Started, not working yet",
  some: "Works some runs",
  every: "Works on every run",
};

export function isMissionStatus(value: string): value is MissionStatus {
  return (MISSION_STATUSES as readonly string[]).includes(value);
}

/** "Working" = some + every. Used for "6 of 15 working". */
export function isWorking(status: MissionStatus) {
  return status === "some" || status === "every";
}

export function missionCode(number: number) {
  return `M${String(number).padStart(2, "0")}`;
}
